"use strict"


const DOWNLOAD_QUEUE = new Map();
const DOWNLOAD_WAIT = new Set();
chrome.downloads.onChanged.addListener((delta) =>
{
    if (!DOWNLOAD_QUEUE.get(delta.id))
        return;
    if (delta.state && delta.state.current === "complete")
    {
        const url = DOWNLOAD_QUEUE.get(delta.id);
        DOWNLOAD_QUEUE.delete(delta.id);
        URL.revokeObjectURL(url);
        console.log("finish download [" + delta.id + "], revoke:", url);
    }
});
chrome.downloads.onCreated.addListener(item =>
{
    if (!DOWNLOAD_WAIT.has(item.url))
        return;
    DOWNLOAD_QUEUE.set(item.id, item.url);
    DOWNLOAD_WAIT.delete(item.url);
});

class DownloadMan
{
    /**
     * @param {Blob|string} data
     * @param {string} filename
     */
    static download(data, filename)
    {
        const isBlob = data instanceof Blob;
        const url = isBlob ? URL.createObjectURL(data) : data;
        if (isBlob)
            console.log("export blob data to:", url);
        else if (!typeof(data) === "string")
        {
            console.warn("unknown data type", data);
            return;
        }
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.style.display = "none";
        anchor.download = filename;
        document.body.appendChild(anchor);
        DOWNLOAD_WAIT.add(url);
        anchor.click();
    }
    /**
     * @param {object | string | ArrayBuffer} data
     * @param {string} type
     * @param {string} filename
     */
    static exportDownload(data, type, filename)
    {
        let blob;
        switch (type)
        {
            case "txt":
                blob = new Blob([data], { type: "text/plain" }); break;
            case "json":
                blob = new Blob([JSON.stringify(data)], { type: "application/json" }); break;
            case "bin":
                blob = new Blob([data], { type: "application/octstream" }); break;
            default:
                return;
        }
        DownloadMan.download(blob, filename);
    }
}