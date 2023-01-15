const fetch = require('node-fetch')
const xml2js = require('xml2js')

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
            const distance = Math.hypot(xDistance, yDistance) / 1000
            return {
                distance: distance,
                violating: distance <= 100 ? true : false,
                serialNumber: drone.serialNumber[0],
                timestamp: new Date(),
            }
        })

        // Get the violating drones by checking if the distance is within 100 meters of the nesting site
        const violations = drones.filter((drone) => drone.violating)

        // Filter out old violations
        const newViolations = violations.filter(
            (violation) =>
                !NDZviolations.some(
                    (oldViolation) =>
                        violation.serialNumber === oldViolation.serialNumber
                )
        )

        // Get the contact information for the pilots of the violating drones
        const pilotsPromise = newViolations.map(async (drone) => {
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

        const newViolationsWithPilots = await Promise.all(pilotsPromise)

        // Update NDZviolations with new  data if necessary
        const updatedViolations = NDZviolations.map((oldViolation) => {
            const newData = drones.find(
                (drone) => drone.serialNumber === oldViolation.serialNumber
            )
            if (newData) {
                return {
                    ...oldViolation,
                    timestamp: newData.timestamp,
                    distance: Math.min(newData.distance, oldViolation.distance),
                    violating: newData.distance <= 100 ? true : false,
                }
            }
            return oldViolation
        })

        // Update NDZviolations with new violation data
        // filter out drones not detected in 10 minutes
        // Sort violations by time detected
        NDZviolations = [...updatedViolations, ...newViolationsWithPilots]
            .filter(
                (violation) =>
                    Date.now() - violation.timestamp <= 10 * 60 * 1000
            )
            .sort((a, b) => {
                return new Date(b.timestamp) - new Date(a.timestamp)
            })

        //console.log(NDZviolations)
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
