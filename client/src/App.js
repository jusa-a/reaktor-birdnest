import { useState, useEffect } from 'react'
import droneService from './services/drones'
import './App.css'

const App = () => {
    const [drones, setDrones] = useState([])

    useEffect(() => {
        const interval = setInterval(() => {
            droneService.getAll().then((response) => {
                setDrones(response.data)
            })
        }, 500)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className='App'>
            <h1>NDZ violations in last 10 min</h1>
            <p>(active violations highlighted in red)</p>
            <a href='https://github.com/jusa-a/reaktor-birdnest'>
                <p>link to GitHub</p>
            </a>
            <div>
                {!drones[0] ? (
                    <h2>No drone data yet, please wait...</h2>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Email</th>
                                <th>Closest Distance</th>
                                <th>Last Detected</th>
                            </tr>
                        </thead>
                        <tbody>
                            {drones.map((drone) => (
                                <tr
                                    key={drone.serialNumber}
                                    style={{
                                        backgroundColor: drone.violating
                                            ? '#f48989'
                                            : '',
                                    }}
                                >
                                    <td>
                                        {drone.pilot.firstName}{' '}
                                        {drone.pilot.lastName}
                                    </td>
                                    <td>{drone.pilot.phoneNumber}</td>
                                    <td>{drone.pilot.email}</td>
                                    <td>{drone.distance.toFixed(2)} m</td>
                                    <td>
                                        {new Date(
                                            drone.timestamp
                                        ).toLocaleString('en-GB', {
                                            timeZone: 'Europe/Helsinki',
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

export default App
