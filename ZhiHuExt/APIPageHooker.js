"use strict"

switch(window.location.pathname)
{
    case "/autospider":
        {
            const frame = document.createElement('iframe');
            frame.width = "100%";
            frame.height = "100%";
            frame.src = chrome.extension.getURL('AutoSpider.html');
            document.addEventListener("DOMContentLoaded", () =>
            {
                setTimeout(()=>document.body.appendChild(frame), 1500); // workaround for JSONView
            });
            frame.onload = ()=>fetch("https://api.zhihu.com/getcookie", { credentials: "include" });
        }
        break;
}

