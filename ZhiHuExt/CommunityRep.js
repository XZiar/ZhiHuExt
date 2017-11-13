"use strict"

!function ()
{
    console.log("community-report page");

    const cmrepotObserver = new MutationObserver(records =>
    {
        /**@type {HTMLTableRowElement[]}*/
        let rows = [];
        let subnav;
        for (let ridx = 0; ridx < records.length; ++ridx)
        {
            const record = records[ridx];
            if (record.type != "childList")
                continue;
            const nodes = record.addedNodes;
            for (let nidx = 0; nidx < nodes.length; ++nidx)
            {
                const node = nodes[nidx];
                if (node instanceof HTMLTableRowElement)
                    rows.push(node);
                else if (node instanceof HTMLDivElement && node.className.includes("Community-subNav"))
                    subnav = node;
                else if (node instanceof HTMLElement)
                {
                    rows = rows.concat(Array.from(node.querySelectorAll("tr")));
                    if (!subnav)
                        subnav = node.querySelector("div.Community-subNav");
                }
            }
        }
        if (subnav)
        {
            const chkAll = createButton(["Btn-QCheckStatusAll"], "检测全部");
            const prevPage = createButton(["Btn-Page"], "上一页");
            prevPage.dataset.type = "prev";
            const nextPage = createButton(["Btn-Page"], "下一页");
            nextPage.dataset.type = "next";

            $(subnav).prepend(nextPage);
            $(subnav).prepend(chkAll);
            $(subnav).prepend(prevPage);
        }
        if (rows.length === 0)
            return;
        console.log("find " + rows.length + " table-row", rows);
        const spams = [];
        const userUpds = [];
        for (let ridx = 0; ridx < rows.length; ++ridx)
        {
            /**@type {HTMLTableCellElement[]}*/
            const tds = Array.from(rows[ridx].childNodes)
                .filter(child => child instanceof HTMLTableCellElement);
            if (tds.length !== 5)
                continue;
            if (tds[2].innerText === "用户")
            {
                const link = tds[3].querySelector("a").href;
                const uid = link.split("/").pop();
                spams.push({ id: uid, type: "member" });
                if (tds[4].innerText.includes("已封禁"))
                    userUpds.push(uid);
            }
        }
        ContentBase._report("spams", spams);
        ContentBase._update("users", "id", userUpds, { status: "ban" });
    });

    /**
     * @param {string} uid
     * @param {HTMLTableCellElement} cell
     */
    async function checkUserStatus(uid, cell)
    {
        const user = await ContentBase.checkUserState(uid);
        if (!user)
            return;
        if (user.status === "ban" || user.status === "sban")
            cell.style.background = "black";
        else
            cell.style.background = "rgb(0,224,32)";
        //ContentBase._report("users", user);//checkUserState has included thisuser
    }

    $("body").on("click", "button.Btn-QCheckStatusAll", async function (e)
    {
        const thisbtn = $(this)[0];
        const isCtrl = e.ctrlKey, isShift = e.shiftKey;

        /**@type {[string,HTMLTableCellElement][]}*/
        let objs = [];
        $("tbody > tr", document).toArray()
            .map(tr => Array.from(tr.childNodes).filter(child => child instanceof HTMLTableCellElement))
            .filter((/**@type {HTMLTableCellElement[]}*/tds) => tds.length === 5 && tds[2].innerText === "用户" && tds[3].style.backgroundColor == "")
            .forEach((/**@type {HTMLTableCellElement[]}*/tds) =>
            {
                const link = tds[3].querySelector("a").href;
                const uid = link.split("/").pop();
                if (!isShift && tds[4].innerText.includes("已封禁"))
                    return;
                objs.push([uid, tds[3]]);
            });
        const banset = isCtrl ? new Set() : (await ContentBase.checkSpam("users", objs.map(x => x[0]))).banned;
        objs = objs.filter(x => !banset.has(x[0]));
        console.log("detect " + objs.length + " users", objs);

        for (let i = 0; i < objs.length; ++i)
        {
            const [uid, cell] = objs[i];
            thisbtn.textContent = uid;
            checkUserStatus(uid, cell);
            await _sleep(400);
        }
        thisbtn.textContent = "检测全部";
    });
    $("body").on("click", "button.Btn-Page", e =>
    {
        const thisbtn = e.target;
        const objtype = thisbtn.dataset.type;
        /**@type {HTMLAnchorElement[]}*/
        const pagers = $("div.Community-Pager > a").toArray();
        const objbtn = pagers.filter(p => p.dataset.key === objtype)[0];
        objbtn.click();
    });


    cmrepotObserver.observe($(".zu-main-content-inner")[0], { "childList": true, "subtree": true });
}()