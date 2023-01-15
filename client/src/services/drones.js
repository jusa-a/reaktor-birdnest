import axios from 'axios'
const baseUrl = '/drones'

// Get data from backend
const getAll = async () => {
    return await axios.get(baseUrl)
}

// eslint-disable-next-line
export default { getAll }
