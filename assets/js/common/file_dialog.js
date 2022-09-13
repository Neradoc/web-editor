import {GenericModal, ProgressDialog} from './dialogs.js'

const FILE_DIALOG_OPEN = 1;
const FILE_DIALOG_SAVE = 2;
const FILE_DIALOG_MOVE = 3;
const FILE_DIALOG_COPY = 4;

// This is for mapping file extensions to font awesome icons
const extensionMap = {
    "wav": {icon: "file-audio", type: "bin"},
    "mp3": {icon: "file-audio", type: "bin"},
    "bmp": {icon: "file-image", type: "bin"},
    "gif": {icon: "file-image", type: "bin"},
    "jpg": {icon: "file-image", type: "bin"},
    "jpeg": {icon: "file-image", type: "bin"},
    "zip": {icon: "file-archive", type: "bin"},
    "py": {icon: "file-alt", type: "text"},
    "json": {icon: "file-code", type: "text"},
    "mpy": {icon: "file", type: "bin"},
    "txt": {icon: "file-alt", type: "text"},
    "mov": {icon: "file-video", type: "bin"},
    "mp4": {icon: "file-video", type: "bin"},
    "avi": {icon: "file-video", type: "bin"},
    "wmv": {icon: "file-video", type: "bin"},
}

class FileDialog extends GenericModal {
    constructor(modalId, showBusy) {
        super(modalId);
        this._showBusy = showBusy;
        this._currentPath = "/";
        this._fileHelper = null;
        this._readOnlyMode = false;
        this._progressDialog = null;
    }

    _removeAllChildNodes(parent) {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
    }

    _getExtension(filename) {
        let extension = filename.split('.').pop();
        if (extension !== null) {
            return String(extension).toLowerCase()
        }
        return extension;
    }

    _getIcon(fileObj) {
        if (fileObj.isDir) return "fa-folder";
        const fileExtension = this._getExtension(fileObj.path);
        if (fileExtension in extensionMap) {
            return "fa-" + extensionMap[fileExtension].icon;
        }

        return "fa-file";
    }

    _getType(fileObj) {
        if (fileObj.isDir) return "folder";
        const fileExtension = this._getExtension(fileObj.path);
        if (fileExtension in extensionMap) {
            return extensionMap[fileExtension].type;
        }

        return "bin";
    }

    async open(fileHelper, type, hidePaths=null) {
        if (![FILE_DIALOG_OPEN, FILE_DIALOG_SAVE, FILE_DIALOG_MOVE, FILE_DIALOG_COPY].includes(type)) {
            return;
        }
        this._fileHelper = fileHelper;
        this._readOnlyMode = await this._showBusy(this._fileHelper.readOnly());
        this._hidePaths = hidePaths ? hidePaths : new Set();

        let p = super.open()
        const cancelButton = this._currentModal.querySelector("button.cancel-button");
        this._addDialogElement('cancelButton', cancelButton, 'click', this._closeModal);
        const okButton = this._currentModal.querySelector("button.ok-button");
        this._addDialogElement('okButton', okButton, 'click', this._handleOkButton);
        this._setElementEnabled('okButton', this._validSelectableFolder());
        const delButton = this._currentModal.querySelector("#del-button");
        this._addDialogElement('delButton', delButton, 'click', this._handleDelButton);
        this._setElementEnabled('delButton', false);
        const renameButton = this._currentModal.querySelector("#rename-button");
        this._addDialogElement('renameButton', renameButton, 'click', this._handleRenameButton);
        this._setElementEnabled('renameButton', false);
        const downloadButton = this._currentModal.querySelector("#download-button");
        this._addDialogElement('downloadButton', downloadButton, 'click', this._handleDownloadButton);
        this._setElementEnabled('downloadButton', false);
        const uploadButton = this._currentModal.querySelector("#upload-button");
        this._addDialogElement('uploadButton', uploadButton, 'click', this._handleUploadButton);
        this._setElementEnabled('uploadButton', !this._readOnlyMode);
        const newFolderButton = this._currentModal.querySelector("#new-folder-button");
        this._addDialogElement('newFolderButton', newFolderButton, 'click', this._handleNewFolderButton);
        this._setElementEnabled('newFolderButton', !this._readOnlyMode);
        const moveButton = this._currentModal.querySelector("#move-button");
        this._addDialogElement('moveButton', moveButton, 'click', this._handleMoveButton);
        this._setElementEnabled('moveButton', false);
        const fileNameField= this._currentModal.querySelector("#filename");

        if (type == FILE_DIALOG_OPEN) {
            this._currentModal.setAttribute("data-type", "open");
            this._setElementHtml('okButton', "Open");
            this._addDialogElement('fileNameField', fileNameField);
        } else if (type == FILE_DIALOG_SAVE) {
            this._currentModal.setAttribute("data-type", "save");
            this._setElementHtml('okButton', "Save");
            this._addDialogElement('fileNameField', fileNameField, 'input', this._handleFilenameUpdate);
        } else if (type == FILE_DIALOG_MOVE) {
            this._currentModal.setAttribute("data-type", "folder-select");
            this._setElementHtml('okButton', "Move");
            this._addDialogElement('fileNameField', fileNameField);
        } else if (type == FILE_DIALOG_COPY) {
            this._currentModal.setAttribute("data-type", "folder-select");
            this._setElementHtml('okButton', "Copy");
            this._addDialogElement('fileNameField', fileNameField);
        }

        this._setElementValue('fileNameField', "");
        this._setElementEnabled('fileNameField', type == FILE_DIALOG_SAVE);
        this._addDialogElement('fileList', this._currentModal.querySelector("#file-list"));
        this._addDialogElement('currentPathLabel', this._currentModal.querySelector("#current-path"));
        this._progressDialog = new ProgressDialog("progress");

        await this._openFolder();

        return p;
    }

    async _openFolder(path) {
        const fileList = this._getElement('fileList');
        this._removeAllChildNodes(fileList);
        if (path !== undefined) {
            this._currentPath = path;
        }
        const currentPathLabel = this._getElement('currentPathLabel');
        currentPathLabel.innerHTML = this._currentPath;

        if (this._currentPath != "/") {
            this._addFile({path: "..", isDir: true}, "fa-folder-open");
        }
        if (!this._fileHelper) {
            console.log("no client");
            return;
        }

        try {
            const files = this._sortFolderFirst(await this._showBusy(this._fileHelper.listDir(this._currentPath)));
            for (let fileObj of files) {
                if (fileObj.path[0] == ".") continue;
                if (this._currentModal.getAttribute("data-type") == "folder-select" && !fileObj.isDir) continue;
                if (this._hidePaths.has(this._currentPath + fileObj.path)) continue;
                this._addFile(fileObj);
            }    
        } catch(e) {
            console.log(e);
        }
        this._setElementValue('fileNameField', "");
        this._setElementEnabled('okButton', this._validSelectableFolder());
    }

    _validSelectableFolder() {
        if (this._currentModal.getAttribute("data-type") != "folder-select") {
            return false;
        }
        if (this._hidePaths.has(this._currentPath)) {
            return false;
        }
        return true;
    }

    _handleFileClick(clickedItem) {
        for (let listItem of this._getElement('fileList').childNodes) {
            listItem.setAttribute("data-selected", listItem.isEqualNode(clickedItem));
            if (listItem.isEqualNode(clickedItem)) {
                listItem.classList.add("selected");
            } else {
                listItem.classList.remove("selected");
            }
        }
        if (clickedItem.getAttribute("data-type") != "folder") {
            this._getElement('fileNameField').value = clickedItem.querySelector("span").innerHTML;
        }

        this._setElementEnabled('okButton', clickedItem.getAttribute("data-type") != "bin");
        this._setElementEnabled('delButton', this._canPerformWritableFileOperation());
        this._setElementEnabled('renameButton', this._canPerformWritableFileOperation());
        this._setElementEnabled('moveButton', this._canPerformWritableFileOperation());
        this._setElementEnabled('downloadButton', this._canDownload());
    }

    _handleFilenameUpdate() {
        const fileNameField = this._getElement('fileNameField');
        this._setElementEnabled('okButton', this._validFilename(fileNameField.value));
    }

    _validFilename(filename) {
        const fileList = this._getElement('fileList');
        
        // Check for invalid characters
        if (!this._validName(filename)) {
            return false;
        }

        // Check if filename is a folder that exists
        for (let listItem of fileList.childNodes) {
            if (listItem.getAttribute("data-type") == "folder") {
                if (listItem.querySelector("span").innerHTML == filename) {
                    return false;
                }
            }
        }

        return true;
    }

    _validName(name) {
        if (!name || name == '' || name == "." || name == ".." || name.includes("/")) {
            return false;
        }

        // For now, don't allow hidden files
        if (name[0] == ".") {
            return false;
        }

        return true;
    }

    _nameExists(fileName) {
        const fileList = this._getElement('fileList');

        // Check if a file or folder already exists
        for (let listItem of fileList.childNodes) {
            if (listItem.querySelector("span").innerHTML == fileName) {
                return true;
            }
        }

        return false;
    }

    _canPerformWritableFileOperation(includeFolder=true) {
        if (this._readOnlyMode) {
            return false;
        }
        let selectedItem = this._getSelectedFile();
        if (!selectedItem) {
            return false;
        }
        let filename = selectedItem.querySelector("span").innerHTML;
        if (!this._validName(filename)) {
            return false;
        }
        if (!includeFolder && selectedItem.getAttribute("data-type") == "folder") {
            return false;
        }
        return true;
    }

    _canDownload() {
        let selectedItem = this._getSelectedFile();
        if (!selectedItem) {
            return false;
        }
        if (selectedItem.getAttribute("data-type") == "folder") {
            return false;
        }
        if (!this._validName(selectedItem.querySelector("span").innerHTML)) {
            return false;
        }
        return true;
    }

    async _handleOkButton() {
        await this._openItem();
    }

    async _handleDelButton() {
        if (!this._canPerformWritableFileOperation()) return;

        let filename = this._getSelectedFilename();
        filename = this._currentPath + filename;

        if (!confirm(`Are you sure you want to delete ${filename}?`)) {
            return; // If cancelled, do nothing
        }

        // Delete the item
        await this._showBusy(this._fileHelper.delete(filename));
        // Refresh the file list
        await this._openFolder();
    };

    async _handleUploadButton() {
        if (this._readOnlyMode) return;

        const uploadTypeDialog = new ButtonValueDialog("upload-type");
        const uploadType = await uploadTypeDialog.open();

        if (uploadType == "files") {
            await this._upload(false);
        } else if (uploadType == "folders") {
            await this._upload(true);
        }
    }

    round(number, decimalPlaces) {
        if (decimalPlaces < 1) {
            return Math.round(number);
        }

        return Math.round(number * (decimalPlaces * 10)) / (decimalPlaces * 10);
    }

    prettySize(filesize) {
        const units = ["Bytes", "KB", "MB", "GB"];
        let unitIndex = 0;
        while (filesize > 1024 && unitIndex < units.length) {
            unitIndex += 1;
            filesize /= 1024;
        }
        return `${this.round(filesize, 1)} ${units[unitIndex]}`;
    }

    async _upload(onlyFolders=false) {
        if (this._readOnlyMode) return;

        let input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.webkitdirectory = onlyFolders;
        input.addEventListener('change', async (event) => {
            const readUploadedFileAsArrayBuffer = (inputFile) => {
                const reader = new FileReader();

                return new Promise((resolve, reject) => {
                  reader.onerror = () => {
                    reader.abort();
                    reject(new DOMException("Problem parsing input file."));
                  };
            
                  reader.onload = () => {
                    resolve(reader.result);
                  };
                  reader.readAsArrayBuffer(inputFile);
                });
            };
            let files = Array.from(input.files);
            let totalBytes = 0;
            let bytesCompleted = 0;
            for(let file of files) {             
                totalBytes += file.size;
            }

            let madeDirs = new Set();
            this._progressDialog.open();
            for(let [index, file] of files.entries()) {
                let filename = file.name;
                if (file.webkitRelativePath) {
                    filename = file.webkitRelativePath;
                    let parentDir = filename.split("/").slice(0, -1).join("/");
                    if (!madeDirs.has(parentDir)) {
                        this._progressDialog.setStatus(`Creating Folder ${parentDir}...`);
                        await this._fileHelper.makeDir(this._currentPath + parentDir);
                        await this._openFolder();
                        madeDirs.add(parentDir);
                    }
                }
                bytesCompleted += file.size;
                if (this._nameExists(filename) && !confirm(`${filename} already exists. Overwrite?`)) {
                    this._progressDialog.setPercentage(bytesCompleted / totalBytes * 100);
                    continue; // If cancelled, continue
                }

                let contents = await readUploadedFileAsArrayBuffer(file);
                this._progressDialog.setStatus(`Uploading file ${filename} (${this.prettySize(file.size)})...`);
                await this._showBusy(this._fileHelper.writeFile(
                    this._currentPath + filename,
                    0,
                    contents,
                    file.lastModified,
                    true
                ), false);
                this._progressDialog.setPercentage(bytesCompleted / totalBytes * 100);
            };
            this._progressDialog.close();

            // Refresh the file list
            await this._openFolder();
        });
        input.click();
    }

    // Currently only files are downloadable, but it would be nice to eventually download zipped folders
    async _handleDownloadButton() {
        if (!this._canDownload()) return;

        let filename = this._getSelectedFilename();
        let getBlob = async () => {
            let response = await this._fileHelper.readFile(this._currentPath + filename, true);
            return response.blob();
        }
        let blob = await this._showBusy(getBlob());
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.setAttribute('download', filename);
        a.click();
    }

    async _handleMoveButton() {
        const newFolderDialog = new FileDialog("folder-select", this._showBusy);
        let hidePaths = new Set();
        hidePaths.add(this._getSelectedFilePath());
        hidePaths.add(this._currentPath);
        let newFolder = await newFolderDialog.open(this._fileHelper, FILE_DIALOG_MOVE, hidePaths);

        if (newFolder) {
            const filename = this._getSelectedFilename();
            const filetype = this._getSelectedFileType() == "folder" ? "folder" : "file";
            const oldPath = this._currentPath + filename;
            const newPath = newFolder + filename;
            if (await this._showBusy(this._fileHelper.fileExists(newPath))) {
                this._showMessage(`Error moving ${oldPath}. Another ${filetype} with the same name already exists at ${newPath}.`);
            } else if (!(await this._showBusy(this._fileHelper.move(oldPath, newPath)))) {
                this._showMessage(`Error moving ${oldPath} to ${newPath}. Make sure the ${filetype} you are moving exists.`);
            } else {
                // Go to the new location
                await this._openFolder(newFolder);
            }
        }
    }
    
    async _handleRenameButton() {
        if (!this._canPerformWritableFileOperation()) return;

        let oldName = this._getSelectedFilename();
        let newName = prompt("Enter a new folder name", oldName);
        // If cancelled, do nothing
        if (!newName) {
            return;
        }
        // If invalid, display message
        if (newName == oldName) {
            return;
        } else if (!this._validName(newName)) {
            await this._showMessage(`'${newName}' is an invalid name.`);
            return;
        } else if (this._nameExists(newName)) {
            await this._showMessage(`'${newName}' already exists.`);
            return;
        }

        // Rename the file, by moving in the same folder
        await this._showBusy(
            this._fileHelper.move(
                this._currentPath + oldName,
                this._currentPath + newName
            )
        );

        // Refresh the file list
        await this._openFolder();
    }

    async _handleNewFolderButton() {
        if (this._readOnlyMode) return;
        // prompt for new folder name
        let folderName = prompt("Enter a new folder name");
        // If cancelled, do nothing
        if (!folderName) {
            return;
        }
        // If invalid, display message
        if (!this._validName(folderName)) {
            await this._showMessage(`'${folderName}' is an invalid name.`);
            return;
        } else if (this._nameExists(folderName)) {
            await this._showMessage(`'${folderName}' already exists.`);
            return;
        }

        // otherwise create a folder
        await this._showBusy(this._fileHelper.makeDir(this._currentPath + folderName));

        // Refresh the file list
        await this._openFolder();
    };

    _getSelectedFile() {
        // Loop through items and see if any have data-selected
        for (let listItem of this._getElement('fileList').childNodes) {
            if ((/true/i).test(listItem.getAttribute("data-selected"))) {
                return listItem;
            }
        }

        return null;
    }

    _getSelectedFilename() {
        let file = this._getSelectedFile();
        if (file) {
            return file.querySelector("span").innerHTML
        }
        return null;
    }

    _getSelectedFileType() {
        let file = this._getSelectedFile();
        if (file) {
            return file.getAttribute("data-type");
        }
        return null;
    }
    
    _getSelectedFilePath() {
        let filename = this._getSelectedFilename();
        if (!filename) return null;

        if (this._getSelectedFileType() != "folder") {
            return this._currentPath;
        }

        return this._currentPath + filename;
    }

    async _openItem(item, forceNavigate=false) {
        const fileNameField = this._getElement('fileNameField');
        let filetype, filename;
        let selectedItem = this._getSelectedFile();

        if (item !== undefined) {
            filetype = item.getAttribute("data-type");
            filename = item.querySelector("span").innerHTML;
        } else if (this._validFilename(fileNameField.value)) {
            // This only makes sense if opening a file, otherwise it should be the opposite
            if (selectedItem !== null && fileNameField.value != selectedItem.querySelector("span").innerHTML && this._currentModal.getAttribute("data-type") == "open") {
                filetype = selectedItem.getAttribute("data-type");
                filename = selectedItem.querySelector("span").innerHTML;
            } else {
                filename = fileNameField.value;
                filetype = "text";
            }
        } else if (selectedItem !== null) {
            filetype = selectedItem.getAttribute("data-type");
            filename = selectedItem.querySelector("span").innerHTML;
        }

        if (filename !== undefined && filetype !== undefined) {
            if (filetype == "folder") {
                if (filename == "..") {
                    let pathParts = this._currentPath.split("/");
                    pathParts.pop();
                    pathParts.pop();
                    this._currentPath = pathParts.join("/") + "/";
                    await this._openFolder();
                } else {
                    if (forceNavigate || (this._currentModal.getAttribute("data-type") != "folder-select")) {
                        await this._openFolder(this._currentPath + filename + "/");
                    } else {
                        this._returnValue(this._currentPath + filename + "/");
                    }
                }
            } else if (filetype == "text") {
                this._returnValue(this._currentPath + filename);
            } else {
                await this._showMessage("Unable to use this type of file");
            }
        } else if (!forceNavigate && this._validSelectableFolder()) {
            this._returnValue(this._currentPath);
        }
    }

    _sortFolderFirst(fileObjects) {
        let files = [];
        let folders = [];

        for (let fileObj of fileObjects) {
            if (fileObj.isDir) {
                folders.push(fileObj);
            } else {
                files.push(fileObj);
            }
        }

        return this._sortAlpha(folders).concat(this._sortAlpha(files))
    }

    _sortAlpha(files) {
        return files.sort(function(a, b) {
            var keyA = a.path;
            var keyB = b.path;
            return keyA.localeCompare(keyB);
          });
    }
    
    _addFile(fileObj, iconClass) {
        const fileList = this._getElement('fileList');
        let fileItem = document.createElement("A");
        fileItem.setAttribute("data-type", this._getType(fileObj));
        fileItem.addEventListener("click", (event) => {
            let clickedItem = event.target;
            if (clickedItem.tagName.toLowerCase() != "a") {
                clickedItem = clickedItem.parentNode;
            }
            this._handleFileClick(clickedItem);
        });
        fileItem.addEventListener("dblclick", async (event) => {
            let clickedItem = event.target;
            if (clickedItem.tagName.toLowerCase() != "a") {
                clickedItem = clickedItem.parentNode;
            }
            this._openItem(clickedItem, true);
        });

        let iconElement = document.createElement("I");
        iconElement.classList.add("far");
        if (iconClass !== undefined) {
            iconElement.classList.add(iconClass);
        } else {
            iconElement.classList.add(this._getIcon(fileObj));
        }
        let filename = document.createElement("SPAN");
        filename.innerHTML = fileObj.path;
        fileItem.appendChild(iconElement);
        fileItem.appendChild(filename);
        fileList.appendChild(fileItem);
    }
}

export {
    FileDialog,
    FILE_DIALOG_OPEN,
    FILE_DIALOG_SAVE,
    FILE_DIALOG_MOVE,
    FILE_DIALOG_COPY
}