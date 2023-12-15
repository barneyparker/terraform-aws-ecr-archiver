#!/usr/bin/env python

import argparse
import boto3
import json

def process_layer(registryId, sourceRepositoryName, targetRepositoryName, layerDigest, Bucket):
  # check to see if the layer already exists in the target repository
  availability = ecr.batch_check_layer_availability(
    registryId = registryId,
    repositoryName = targetRepositoryName,
    layerDigests = [layerDigest]
  )

  if(availability['layers'][0]['layerAvailability'] == 'AVAILABLE'):
    print('Layer ' + layerDigest + ' already exists in target repository')
  else:
    print('Downloading layer: ' + layerDigest)
    object = s3.get_object(
      Bucket = Bucket,
      Key = sourceRepositoryName + '/layers/' + layerDigest
    )
    body = object['Body'].read()

    # initiate a layer upload to ecr
    layer = ecr.initiate_layer_upload(
      registryId = current_account_id,
      repositoryName = targetRepositoryName
    )

    print('Uploading layer: ' + layerDigest + ' uploadId: ' + layer['uploadId'])

    # upload the layer to the target ecr repository in max 20MB chunks
    chunk_max = 20000000
    index = 0
    while index < len(body):
      print('chunk index: ' + str(index/chunk_max))
      size = min(len(body) - index, chunk_max)
      response = ecr.upload_layer_part(
        registryId=current_account_id,
        repositoryName=targetRepositoryName,
        uploadId=layer['uploadId'],
        partFirstByte=index,
        partLastByte=index + size - 1,
        layerPartBlob=body[index:index + size]
      )
      index += size

    # complete the layer upload
    print('Completing Upload')
    ecr.complete_layer_upload(
      registryId=current_account_id,
      repositoryName=targetRepositoryName,
      uploadId=layer['uploadId'],
      layerDigests = [layerDigest]
    )

def get_manifest(Bucket, Key):
  object = s3.get_object(Bucket=Bucket, Key=Key)
  manifest = object['Body'].read()
  parsed = json.loads(manifest)
  return parsed, object['ContentType']

def upload_manifest(registryId, repositoryName, imageManifest, imageManifestMediaType, imageTag):
  # check to see if the image already exists in the target repository
  image = ecr.batch_get_image(
    registryId = registryId,
    repositoryName = repositoryName,
    imageIds = [{
      'imageTag': imageTag
    }]
  )

  if len(image['images']) > 0:
    print('Image ' + imageTag + ' already exists in ' + repositoryName)
  else:
    ecr.put_image(
      registryId = registryId,
      repositoryName = repositoryName,
      imageManifest = imageManifest,
      imageManifestMediaType = imageManifestMediaType,
      imageTag = imageTag
    )
    print('Image: ' + imageTag + ' uploaded to ' + repositoryName + ' successfully')



if __name__ == '__main__':
  # parse the parameters passed to the script
  parser = argparse.ArgumentParser(
    prog = 'restore.py',
    description = 'Restore container(s) from an Archive.',
  )
  parser.add_argument('-b', '--bucket',   required=True,  default=None, help='The bucket name where the manifest and layers are stored')
  parser.add_argument('-s', '--source',   required=True,  default=None, help='The repo directory in the bucket')
  parser.add_argument('-m', '--manifest', required=False, default=None, help='The manifest name (omit for all manifests in repo directory)')
  parser.add_argument('-t', '--target',   required=False, default=None, help='The repository to restore to')
  args = parser.parse_args()

  if(args.target == None):
    args.target = args.source

  # create a boto3 clients
  s3 = boto3.client('s3')
  ecr = boto3.client('ecr')
  sts = boto3.client('sts')

  current_account_id = sts.get_caller_identity().get('Account')

  if(args.manifest == None):
    # get a list of all the manifests in the source repository
    manifest_list = []
    paginator = s3.get_paginator('list_objects_v2')
    page_iterator = paginator.paginate(Bucket=args.bucket, Prefix=args.source + '/tag:')
    for page in page_iterator:
      for item in page['Contents']:
        manifest_list.append(item['Key'].replace(args.source + '/', ''))
  else:
    manifest_list = [args.manifest]

  # process each manifest
  for manifest in manifest_list:
    print('Processing manifest: ' + manifest)
    parts = manifest.split(':')

    # try to read the s3 object
    try:
      manifest, ContentType = get_manifest(Bucket=args.bucket, Key=args.source + '/' + manifest)

      # process all the layers
      for layer in manifest['layers']:
        process_layer(
          registryId = current_account_id,
          sourceRepositoryName = args.source,
          targetRepositoryName = args.target,
          layerDigest = layer['digest'],
          Bucket = args.bucket
        )

      # process the config layer
      process_layer(
        registryId = current_account_id,
        sourceRepositoryName = args.source,
        targetRepositoryName = args.target,
        layerDigest = manifest['config']['digest'],
        Bucket = args.bucket
      )

      # upload the manifest to the target repository
      print('Uploading manifest: ' + parts[2] + ':' + parts[3] + ' tagged ' + parts[1])

      upload_manifest(
        registryId = current_account_id,
        repositoryName = args.target,
        imageManifest = json.dumps(manifest),
        imageManifestMediaType = ContentType,
        imageTag = parts[1]
      )

    except Exception as e:
      print(e)
      print('Failed to process manifest: ' + manifest)
