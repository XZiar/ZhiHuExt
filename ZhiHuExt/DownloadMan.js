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
        const pms = $.Deferred();
        const isBlob = data instanceof Blob;
        const url = isBlob ? URL.createObjectURL(data) : data;
        if (isBlob)
            console.log("export blob data to:", url);
        else if (!(data instanceof string))
        {
            console.warn("unknown data type", data);
            pms.reject("unknown data type:[" + typeof (data) + "]");
            return pms;
        }
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.style.display = "none";
        anchor.download = filename;
        document.body.appendChild(anchor);
        DOWNLOAD_WAIT.add(url);
        anchor.click();
        pms.resolve();
        /*
        chrome.downloads.download({ url: url, filename: filename }, id =>
        {
            if (id === undefined)
            {
                const errMsg = chrome.runtime.lastError;
                console.warn("download wrong", errMsg);
                pms.reject(errMsg);
            }
            else
            {
                console.log("start download [" + id + "]");
                if (isBlob)
                    DOWNLOAD_QUEUE[id] = url;
                pms.resolve(id);
            }
        });
        */
        return pms;
    }
}