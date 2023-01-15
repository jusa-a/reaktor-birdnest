const fetch = require('node-fetch')
const xml2js = require('xml2js')
const { unionBy } = require('lodash/array')

const express = require('express')
const app = express()

const cors = require('cors')
app.use(cors())

// Initialize array for violation data
let NDZviolations = []

const getViolations = async () => {
    try {
        // Make a GET request to the drone monitoring endpoint
        const response = await fetch(
            'https://assignments.reaktor.com/birdnest/drones'
        )
        const xml = await response.text()

        // Parse the XML data
        const result = await xml2js.parseStringPromise(xml)
        const droneData = result.report.capture[0].drone

        // Calculate the distance between each drone and the center of the NDZ and set timestamp
        const drones = droneData.map((drone) => {
            const ndzCenter = { x: 250000, y: 250000 }
            const x = parseFloat(drone.positionX[0])
            const y = parseFloat(drone.positionY[0])
            const xDistance = x - ndzCenter.x
            const yDistance = y - ndzCenter.y
            return {
                x: x,
                y: y,
                distance: Math.hypot(xDistance, yDistance) / 1000,
                serialNumber: drone.serialNumber[0],
                timestamp: new Date(),
            }
        })

        // Get the violating drones by checking if the distance is within 100 meters of the nesting site
        const violations = drones.filter((drone) => drone.distance <= 100)

        // Update the violation information with a violation timestamp
        const violationsWithTimestamps = violations.map((drone) => {
            return {
                ...drone,
                violation_timestamp: new Date(),
            }
        })

        // Get the contact information for the pilots of the violating drones
        const pilotsPromise = violationsWithTimestamps.map(async (drone) => {
            try {
                // Make a GET request to the pilot registry endpoint
                const pilotResponse = await fetch(
                    `https://assignments.reaktor.com/birdnest/pilots/${drone.serialNumber}`
                )
                if (pilotResponse.ok) {
                    const pilot = await pilotResponse.json()
                    return {
                        ...drone,
                        pilot,
                    }
                } else {
                    throw new Error(pilotResponse.statusText)
                }
            } catch (error) {
                console.log(error)
            }
        })

        const violationsWithPilots = await Promise.all(pilotsPromise)
        console.log('new')
        console.log(violationsWithPilots)
        console.log('---')

        // Filter out new violations from violations list
        const oldViolations = NDZviolations.filter(
            (oldViolation) =>
                !violationsWithPilots.some(
                    (violation) =>
                        violation.serialNumber === oldViolation.serialNumber
                )
        )
        console.log('old')
        console.log(oldViolations)
        console.log('---')

        /* // Update NDZviolations with new violation data
        const updatedViolations = NDZviolations.map((oldViolation) => {
            const newViolation = violationsWithPilots.find(
                (violation) =>
                    violation.serialNumber === oldViolation.serialNumber
            )
            if (newViolation) {
                return newViolation
                // TODO, do something about the distance
            }
            return oldViolation
        }) */

        // Combine old violations with new violations with loadash unionBy
        /* NDZviolations = unionBy(
            violationsWithPilots,
            NDZviolations,
            'serialNumber'
        ).filter(
            (violation) => Date.now() - violation.timestamp <= 10 * 60 * 1000
        ) */

        // Update NDZviolations with new violation data and filter out drones not seen in 10 minutes
        NDZviolations = [...oldViolations, ...violationsWithPilots].filter(
            (violation) => Date.now() - violation.timestamp <= 10 * 60 * 1000
        )

        console.log(NDZviolations)
    } catch (error) {
        // Error retrieving drone data
        console.log(error)
    }
}

// Update NDZ violations every second
setInterval(getViolations, 1 * 1000)

// Route for handling requests to the drone monitoring endpoint
app.get('/drones', async (req, res) => {
    // Send the violation data to the frontend
    res.json(NDZviolations)
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
