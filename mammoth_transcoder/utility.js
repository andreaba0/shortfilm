const fs = require('fs')

/**
 * This function write a given string to a file
 * It creates the file if it does not exists
 * 
 * @param {String} string string to write
 * @param {String} file name of the file
 * @returns {Promise} resolve if file has been written successfully, reject if it fails
 */
function writeStringToFile(string, file) {
    return new Promise((resolve, reject) => {
        fs.open(file, 'w', (err, fd) => {
            if (err) return reject(err)
            fs.write(fd, string, (err) => {
                if (err) return reject(err)
                fs.close(fd, (err) => {
                    if (err) return reject(err)
                    return resolve()
                })
            })
        })
    })
}

/**
 * This function, given an array of bytes, write it to a file if it does not exists
 * 
 * @param {Array} bytes array of bytes
 * @param {String} file name of the file
 * @returns {Promise} resolve if file has been written successfully, reject if it fails
 */
function writeToFile(bytes, file) {
    return new Promise((resolve, reject) => {
        fs.open(file, 'wx', (err, fd) => {
            if (err&&err.code==='EEXIST') return reject('File already exists')
            if (err === 'EEXIST') return reject(err)
            fs.write(fd, bytes, (err) => {
                if (err) return reject(err)
                fs.close(fd, (err) => {
                    if (err) return reject(err)
                    return resolve()
                })
            })
        })
    })
}

/**
 * This function write an array of bytes at a specidied position in a file and create it if it does not exists
 * 
 * @param {Array} bytes array of bytes to write
 * @param {String} file name of the file to be written
 * @param {Number} position position in the file where to start writing
 * @return {Promise} resolve if file has been written successfully, reject if it fails
 */
function writeToFileAt(bytes, file, position) {
    return new Promise((resolve, reject) => {
        fs.open(file, 'a+', (err, fd) => {
            if (err) return reject(err)
            fs.write(fd, bytes, 0, bytes.length, position, (err) => {
                if (err) return reject(err)
                fs.close(fd, (err) => {
                    if (err) return reject(err)
                    return resolve()
                })
            })
        })
    })
}

/**
 * This function read string from a file and throw FileNotFound error if the file does not exists
 * 
 * @param {String} file name of the file to read
 * @returns {Promise} return a promise that resolve with the string read from the file, reject if it fails
 */
function readStringFromFile(file) {
    return new Promise((resolve, reject) => {
        fs.open(file, 'r', (err, fd) => {
            if (err) return reject(err)
            fs.readFile(fd, (err, data) => {
                if (err) return reject(err)
                fs.close(fd, (err) => {
                    if (err) return reject(err)
                    return resolve(data)
                })
            })
        })
    })
}

/**
 * This function create and empty file and clear its content if it already exists
 * 
 * @param {String} file name of the file to create
 * @returns {Promise} resolve if file has been created successfully, reject if it fails
 */
function createEmptyFile(file) {
    return new Promise((resolve, reject) => {
        fs.open(file, 'w', (err, fd) => {
            if (err) return reject(err)
            fs.close(fd, (err) => {
                if (err) return reject(err)
                return resolve()
            })
        })
    })
}

/**
 * This function creates directory recursively
 * 
 * @param {String} dir directory to create
 * @returns {Promise} resolve if directory has been created successfully, reject if it fails
 */
function createDirectory(dir) {
    return new Promise((resolve, reject) => {
        fs.mkdir(dir, { recursive: true }, (err) => {
            if (err) return reject(err)
            return resolve()
        })
    })
}

/**
 * This function read all files in a directory
 * 
 * @param {String} dir directory to read
 * @returns {Promise} resolve with an array of files in the directory, reject if it fails
 */
function readDirectory(dir) {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
            if (err) return reject(err)
            return resolve(files)
        })
    })
}

module.exports = {
    writeToFile,
    writeToFileAt,
    writeStringToFile,
    readStringFromFile,
    createEmptyFile,
    createDirectory,
    readDirectory
}