"use strict"

/*
const DOWNLOAD_QUEUE = {};
chrome.downloads.onChanged.addListener((delta) =>
{
    if (!DOWNLOAD_QUEUE.hasOwnProperty(delta.id))
        return;
    if (delta.state && delta.state.current === "complete")
    {
        const url = DOWNLOAD_QUEUE[delta.id];
        delete DOWNLOAD_QUEUE[delta.id];
        URL.revokeObjectURL(url);
        console.log("finish download [" + delta.id + "], revoke:", url);
    }
});*/

class DownloadMan
{
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
        return pms;
    }
}