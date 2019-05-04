"use strict"

function Main()
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
                if (node instanceof HTMLTableRowElement && node.className.includes("ReportItem-row"))
                    rows.push(node);
                else if (node instanceof HTMLDivElement && node.className.includes("Report-tip"))
                    subnav = node;
                else if (node instanceof HTMLElement)
                {
                    rows = rows.concat(Array.from(node.querySelectorAll("tr.ReportItem-row")));
                    if (!subnav)
                        subnav = node.querySelector("div.Community-subNav");
                }
            }
        }
        if (subnav)
        {
            const chkAll = createButton(["Btn-QCheckStatusAll"], "检测全部");
            //const prevPage = createButton(["Btn-Page"], "上一页");
            //prevPage.dataset.type = "prev";
            //const nextPage = createButton(["Btn-Page"], "下一页");
            //nextPage.dataset.type = "next";

            //$(subnav).prepend(nextPage);
            $(subnav).prepend(chkAll);
            //$(subnav).prepend(prevPage);
        }
        if (rows.length === 0)
            return;
        console.log("find " + rows.length + " table-row", rows);
        const spams = [];
        const userBans = [], userSbans = [];
        for (let ridx = 0; ridx < rows.length; ++ridx)
        {
            /**@type {HTMLTableCellElement[]}*/
            const tds = Array.from(rows[ridx].childNodes)
                .filter(child => child instanceof HTMLTableCellElement);
            if (tds.length !== 5)
                continue;
            if (tds[1].innerText === "用户")
            {
                const link = tds[0].querySelector("a.ReportItem-Link").href;
                const uid = link.split("/").pop();
                spams.push({ id: uid, type: "member" });
                if (tds[3].innerText.includes("已封禁"))
                    userBans.push(uid);
                else if (tds[3].innerText.includes("已禁言"))
                    userSbans.push(uid);
            }
        }
        ContentBase._report("spams", spams);
        console.log("userBans", userBans, "userSbans", userSbans);
        ContentBase._update("users", "id", userBans, { status: "ban" });
        ContentBase._update("users", "id", userSbans, { status: "sban" });
    });

    /**
     * @param {string} uid
     * @param {HTMLTableCellElement} cell
     */
    async function checkUserStatus(uid, cell)
    {
        const user = await ContentBase.checkUserState(uid, undefined, [8]);
        if (!user)
            return;
        if (user.status === "ban" || user.status === "sban")
        {
            cell.style.background = "black";
            ContentBase.checkUserState(uid, undefined, [230]);
        }
        else
            cell.style.background = "rgb(0,224,32)";
    }

    $("body").on("click", "button.Btn-QCheckStatusAll", async function (e)
    {
        const thisbtn = $(this)[0];
        const isCtrl = e.ctrlKey, isShift = e.shiftKey;

        /**@type {[string,HTMLTableCellElement][]}*/
        let objs = [];
        $("tbody > tr", document).toArray()
            .map(tr => Array.from(tr.childNodes).filter(child => child instanceof HTMLTableCellElement))
            .filter((/**@type {HTMLTableCellElement[]}*/tds) => tds.length === 5 && tds[1].innerText === "用户" && !tds[3].style.background)
            .forEach((/**@type {HTMLTableCellElement[]}*/tds) =>
            {
                const link = tds[0].querySelector("a.ReportItem-Link").href;
                const uid = link.split("/").pop();
                if (!isShift && (tds[3].innerText.includes("已封禁") || tds[3].innerText.includes("已禁言")))
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
            await _sleep(900 + i * 100);
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


    cmrepotObserver.observe($(".Community")[0], { "childList": true, "subtree": true });
}

Main()