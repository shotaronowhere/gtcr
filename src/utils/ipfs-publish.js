/**
 * Send file to IPFS network via the Kleros IPFS node
 * @param {string} fileName - The name that will be used to store the file. This is useful to preserve extension type.
 * @param {ArrayBuffer} data - The raw data from the file to upload.
 * @param {string} ipfsUrl - The ipfs gateway to use
 * @returns {object} ipfs response. Should include the hash and path of the stored item.
 */
const ipfsPublish = async (fileName, data, ipfsUrl) => {
  const buffer = await Buffer.from(data)

  return new Promise((resolve, reject) => {
    fetch(`${ipfsUrl}/add`, {
      method: 'POST',
      body: JSON.stringify({
        fileName,
        buffer
      }),
      headers: {
        'content-type': 'application/json'
      }
    })
      .then(response => response.json())
      .then(success => resolve(success.data))
      .catch(err => reject(err))
  })
}

export default ipfsPublish