import {ECR} from '@aws-sdk/client-ecr'
import {S3} from '@aws-sdk/client-s3'
import {Upload} from '@aws-sdk/lib-storage'

const ecr = new ECR({region: process.env.AWS_REGION})
const s3 = new S3({region: process.env.AWS_REGION})

const formatBytes = (bytes,decimals) => {
  if(bytes == 0) return '0 Bytes'
  var k = 1024,
    dm = decimals || 2,
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Check if an object exists in S3
 * @param {string} bucketName - The name of the bucket to check
 * @param {string} key - The key of the object to check
 * @returns {boolean} - True if the object exists, false otherwise
 */
const objectExists = async (bucketName, key, expectedSize = -1) => {
  try {
    const result = await s3.headObject({
      Bucket: bucketName,
      Key: key
    })

    if(result.ContentLength === expectedSize) {
      return true
    }
  } catch (err) {
    if(err.name === 'NotFound') {
      return false
    } else {
      console.log(err)
    }
  }

  return false
}

/**
 * Get a list of images in a repository
 * @param {string} repositoryName
 * @returns {Promise[string]} - An array of imageIds
 */
const getImageList = async (repositoryName) => {
  console.log(`Getting image list for ${repositoryName}`)
  const params = {
    repositoryName
  }

  const images = []

  do {
    console.log('getting....')
    const result = await ecr.listImages(params)
    images.push(...result.imageIds)
    params.nextToken = result.nextToken
  } while(params.nextToken)

  console.log(`Found ${images.length} images in ${repositoryName}`)
  return images
}

const getImageDetails = async (repositoryName, images) => {
  console.log(`Getting image details for ${repositoryName}`)
  const params = {
    repositoryName,
    imageIds: images
  }

  const imageDetails = []

  do {
    const result = await ecr.batchGetImage(params)
    imageDetails.push(...result.images)
    params.nextToken = result.nextToken
  } while(params.nextToken)

  console.log(`Got image details for ${imageDetails.length} images in ${repositoryName}`)
  return imageDetails
}

const writeManifests = async (repositoryName, imageDetails) => {
  console.log(`Writing manifests for ${repositoryName}`)
  const layerList = []

  // for each of the images, write the manifest to the S3 bucket at <root>/<repositoryName>/tag:<imageTag><imageDigest> using the mimetype specified in the imageManifest.config.mediaType property
  for(const image of imageDetails) {
    // define the key
    const Key = `${repositoryName}/tag:${image.imageId.imageTag || 'none'}:${image.imageId.imageDigest}`

    // check that the file doesnt already exist
    const exists = await objectExists(process.env.BUCKETNAME, Key, image.imageManifest.length)

    // get a copy of the manifest in usable format
    const manifest = JSON.parse(image.imageManifest)

    // write all the layer details to the layerList
    layerList.push(manifest.layers.map(layer => ({
      layerDigest: layer.digest,
      size: layer.size,
      mediaType: layer.mediaType
    })))

    // write the primary layer to the layer list
    layerList.push({
      layerDigest: manifest.config.digest,
      size: manifest.config.size,
      mediaType: manifest.config.mediaType
    })

    if(!exists) {
      await s3.putObject({
        Bucket: process.env.BUCKETNAME,
        Key,
        Body: image.imageManifest,
        ContentType: image.imageManifestMediaType,
        StorageClass: 'STANDARD_IA'
      })
      console.log(`Manifest: Wrote ${Key} to S3`)
    } else {
      console.log(`Manifest: Skipping ${Key} as it already exists`)
    }
  }

  const flattenedLayerList = layerList.flat()

  const uniqueLayerList = flattenedLayerList.filter((layer, index) => {
    const firstIndex = flattenedLayerList.findIndex(l => l.layerDigest === layer.layerDigest)
    return firstIndex === index
  })

  // return a unique layer list
  return uniqueLayerList
}

const writeLayers = async (repositoryName, layerList) => {
  for(const layer of layerList) {
    // define the key
    const Key = `${repositoryName}/layers/${layer.layerDigest}`

    // check that the file doesnt already exist
    const exists = await objectExists(process.env.BUCKETNAME, Key, layer.size)

    if(!exists) {
      // get the download url for the layer
      const url = await ecr.getDownloadUrlForLayer({
        repositoryName,
        layerDigest: layer.layerDigest
      })

      console.log(`Layer: Streaming ${Key}`)

      try {

        // get the start time
        const startTime = performance.now()

        // start the layer download and get a read stream to pass to the upload
        const response = await fetch(url.downloadUrl)

        const upload = new Upload({
          client: s3,
          params: {
            Bucket: process.env.BUCKETNAME,
            Key,
            ContentType: layer.mediaType,
            Body: response.body
          },
        })

        await upload.done()

        const endTime = performance.now()

        console.log(`Layer: Upload Complete ${formatBytes(layer.size / ((endTime - startTime) / 1000))}/s`)
      } catch (err) {
        console.log(err)
      }

    } else {
      console.log(`Layer: Skipping ${Key} as it already exists`)
    }
  }
}

const archiveRepository = async (repositoryName) => {
  console.log(`Archiving ${repositoryName}`)
  // get a list of all images in the repository
  const images = await getImageList(repositoryName)

  // get the full details for each image
  const imageDetails = await getImageDetails(repositoryName, images)

  // write the manifests to the S3 bucket, and get a list of all the layers
  const layerList = await writeManifests(repositoryName, imageDetails)

  await writeLayers(repositoryName, layerList)
}


export const handler = async () => {
  // get our list of repositories to archive
  let repositories = []

  if(process.env.REPOSITORIES && process.env.REPOSITORIES !== '') {
    repositories = process.env.REPOSITORIES.split(',')
  } else {
    const params = {}

    do {
      const result = await ecr.describeRepositories(params)
      repositories = repositories.concat(result.repositories.map(repo => repo.repositoryName))
      params.nextToken = result.nextToken
    } while(params.nextToken)
  }

  console.log('ECR Repositories to be archived: ', repositories)

  // archive each of the repositories
  for(const repositoryName of repositories) {
    await archiveRepository(repositoryName)
  }

  return true
}