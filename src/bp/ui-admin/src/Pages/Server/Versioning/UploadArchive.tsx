import { Button, Classes, Dialog, FileInput, FormGroup, H4, Intent, Switch, TextArea } from '@blueprintjs/core'
import _ from 'lodash'
import React, { Fragment, useState } from 'react'
import api from '~/api'
import { toastFailure, toastSuccess } from '~/utils/toaster'

const _uploadArchive = async (fileContent: any, doUpdate: boolean) => {
  const { data } = await api
    .getSecured({ timeout: 30000 })
    .post(`/admin/versioning/${doUpdate ? 'update' : 'changes'}`, fileContent, {
      headers: { 'Content-Type': 'application/tar+gzip' }
    })
  return data
}

const checkForChanges = (fileContent: any) => _uploadArchive(fileContent, false)
const sendArchive = (fileContent: any) => _uploadArchive(fileContent, true)

const processChanges = (data: any[]): any => {
  const changeList = _.flatten(data.map(x => x.changes))
  return {
    localFiles: _.flatten(data.map(x => x.localFiles)),
    blockingChanges: changeList.filter(x => ['del', 'edit'].includes(x.action)),
    changeList
  }
}

const prettyLine = ({ action, path, add, del }): string => {
  if (action === 'add') {
    return ` + ${path}`
  } else if (action === 'del') {
    return ` - ${path}`
  } else if (action === 'edit') {
    return ` o ${path} (+${add} / -${del})`
  }
  return ''
}

const UploadArchive = () => {
  const [filePath, setFilePath] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [useForce, setUseForce] = useState(false)
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [changes, setChanges] = useState('')

  const uploadArchive = async () => {
    setIsLoading(true)
    try {
      if (useForce) {
        await sendArchive(fileContent)
        closeDialog()
        toastSuccess(`Changes pushed successfully!`)
        return
      }

      const blockingChanges = processChanges(await checkForChanges(fileContent)).blockingChanges
      if (blockingChanges.length) {
        setChanges(blockingChanges.map(prettyLine).join('\n'))
        return
      }

      await sendArchive(fileContent)
      closeDialog()
      toastSuccess(`Changes pushed successfully!`)
    } catch (err) {
      toastFailure(err)
    } finally {
      setIsLoading(false)
    }
  }

  const readArchive = event => {
    const files = (event.target as HTMLInputElement).files
    if (!files) {
      return
    }

    const fr = new FileReader()
    fr.readAsArrayBuffer(files[0])
    fr.onload = loadedEvent => {
      setFileContent(_.get(loadedEvent, 'target.result'))
    }
    setFilePath(files[0].name)
  }

  const closeDialog = () => {
    setFilePath('')
    setFileContent('')
    setChanges('')
    setDialogOpen(false)
  }

  const renderUpload = () => {
    return (
      <Fragment>
        <div className={Classes.DIALOG_BODY}>
          <FormGroup
            label={<span>Server Archive</span>}
            labelFor="input-archive"
            helperText={
              <span>
                Select an archive exported from another server. If there are conflicts, you will be able to review them
                before pushing.
              </span>
            }
          >
            <FileInput text={filePath || 'Choose file...'} onChange={readArchive} fill={true} />
          </FormGroup>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button
              id="btn-push"
              text={isLoading ? 'Please wait...' : 'Push changes'}
              disabled={!filePath || !fileContent || isLoading}
              onClick={uploadArchive}
              intent={Intent.PRIMARY}
              style={{ height: 20, marginLeft: 5 }}
            />
          </div>
        </div>
      </Fragment>
    )
  }

  const renderConflict = () => {
    return (
      <Fragment>
        <div className={Classes.DIALOG_BODY}>
          <div>
            <H4>Conflict warning</H4>
            <p>
              Remote has changes that are not synced to your environment. Backup your changes and use "pull" to get
              those changes on your file system. If you still want to overwrite remote changes, turn on the switch
              "Force push my changes" then press the button
            </p>
            <TextArea value={changes} rows={22} cols={120} />
          </div>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
              <Switch
                id="chk-useForce"
                checked={useForce}
                onChange={() => setUseForce(!useForce)}
                label="Force push my changes"
                style={{ margin: '3px 20px 0 20px' }}
              />
              <Button
                id="btn-upload"
                text={isLoading ? 'Please wait...' : 'Upload'}
                disabled={!useForce || isLoading}
                onClick={uploadArchive}
                intent={Intent.PRIMARY}
                style={{ height: 20, marginLeft: 5 }}
              />
            </div>
          </div>
        </div>
      </Fragment>
    )
  }

  return (
    <Fragment>
      <Button icon="upload" id="btn-uploadArchive" text="Upload archive" onClick={() => setDialogOpen(true)} />

      <Dialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        transitionDuration={0}
        style={{ width: changes ? 800 : 500 }}
        title="Upload Archive"
        icon="import"
      >
        {!changes ? renderUpload() : renderConflict()}
      </Dialog>
    </Fragment>
  )
}
export default UploadArchive
