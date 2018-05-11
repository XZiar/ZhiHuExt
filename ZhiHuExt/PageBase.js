"use strict"

//common operations on ZhiHu pages

class PageBase
{
    /**
     * @param { {banned: Set<string>, spamed: Set<string>, total: number, normal: string[]} } status
     * @param { HTMLElement | Map<string, HTMLElement> } node
     * @param { string } [uid]
     */
    static setUserStatusColor(status, node, uid)
    {
        if (node instanceof Map)
        {
            for (const id of status.banned)
            {
                const ele = node.get(id);
                ele.style.backgroundColor = ele instanceof HTMLDivElement ? "#a0a0a0" : "black";
            }
            for (const id of status.spamed)
            {
                const ele = node.get(id);
                ele.style.backgroundColor = "cornsilk";
            }
        }
        else
        {
            if (status.banned.has(uid))
                node.style.backgroundColor = node instanceof HTMLDivElement ? "#a0a0a0" : "black";
            else if (status.spamed.has(uid))
                node.style.backgroundColor = "cornsilk";
        }
    }

    /**
     * @param { HTMLElement } node
     * @param { "ban" | "spam" | "fail" | "succ" | "verify" | "repeat" | "clear" } status
     */
    static setChkStatusColor(node, status)
    {
        if (!node)
        {
            console.warn("element that demanded tobe colored does not exists.");
            return;
        }
        switch (status)
        {
            case "ban":
                node.style.backgroundColor = "black"; break;
            case "succ":
                node.style.backgroundColor = "rgb(0,224,32)"; break;
            case "fail":
                node.style.backgroundColor = "rgb(224,0,32)"; break;
            case "verify":
                node.style.backgroundColor = "rgb(32,64,192)"; break;
            case "repeat":
                node.style.backgroundColor = "rgb(224,224,32)"; break;
            case "spam":
                node.style.backgroundColor = "cornsilk"; break;
            case "clear":
                node.style.backgroundColor = ""; break;
        }
    }

}