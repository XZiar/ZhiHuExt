"use strict"

!function ()
{
    "use strict"
    let pageType;
    let uid, qid;
    const url = window.location.href;
    const mth1 = url.match(/zhihu.com\/question\/(\d*)/i);
    const mth2 = url.match(/zhuanlan.zhihu.com\/p\/(\d*)/i);
    const mth3 = url.match(/www.zhihu.com\/(?:org|people)\/([^\/]+)/i);
    const mth4 = url.match(/zhihu.com\/?$/i);
    if (mth1)
        pageType = "question", qid = Number(mth1[1]);
    else if (mth2)
        pageType = "article";
    else if (mth3)
        pageType = "people", uid = mth3[1];
    else if(mth4)
        pageType = "main";
    else
        return;

    console.log(pageType + " page");
    const eleid = pageType === "article" ? "preloadedState" : "data";
    function rootFinder(records)
    {
        for (let i = 0; i < records.length; ++i)
        {
            const record = records[i];
            if (record.type != "childList")
                continue;
            const nodes = record.addedNodes;
            for (let j = 0; j < nodes.length; ++j)
            {
                const node = nodes[j];
                if (!(node instanceof Element))
                    continue;
                if (node.id === eleid)
                    return node;
                const obj = node.querySelector("#" + eleid);
                if (obj)
                    return obj;
            }
        }
        return null;
    }
    const obs = new MutationObserver(records =>
    {
        if (document.body == null)
            return;
        const obj = rootFinder(records);
        if (!obj)
            return;
        obs.disconnect();
        onObjFound(obj);
    });
    obs.observe(document, { "childList": true, "subtree": true });

   
    function onObjFound(obj)
    {
        if (pageType === "article")
        {
            processArticle(obj);
            return;
        }
        const state = JSON.parse(obj.dataset.state);
        console.log(state);
        const entities = APIParser.parseEntities(state.entities);
        ContentBase._report("batch", entities);
        ContentBase.CUR_TOKEN = new UserToken(state.token);
        console.log(entities);
        if (pageType === "people")
        {
            //process user
            ContentBase.CUR_USER = entities.users.filter(u => u.id === uid)[0];
            console.log("the user", ContentBase.CUR_USER);
            setTimeout(peopleEnhance, 800);//later refesh may erase added buttons(sometimes won't), so delay it.
        }
        else if (pageType === "question")
        {
            setTimeout(qstEnhance, 800);//later refesh may erase added buttons, so delay it.
        }
    }

    function processArticle(obj)
    {
        let txt = obj.innerText;
        {
            const part = txt.split("new Date(");
            txt = part[0] + part[1].replace(")", "");
        }
        const artdata = JSON.parse(txt);
        console.log(artdata);

        const artdb = artdata.database;
        const output = new StandardDB();
        {
            //process user
            const selfUser = artdata.me.slug;
            const usersEntry = Object.entries(artdb.User);
            for (let i = 0; i < usersEntry.length; ++i)
            {
                const [name, theuser] = usersEntry[i];
                if (name === selfUser)
                    continue;
                const user = User.fromRawJson(theuser);
                output.users.push(user);
            }

            /**@type {ArtType}*/
            const post = Object.values(artdb.Post)[0];
            output.topics.push(...post.topics.map(t => new Topic(t.id, t.name)));
            const article = new Article(post.slug, post.title, post.author, post.likesCount, post.summary.replace(/<[^>]+>/g, ""),
                Date.parse(post.publishedTime) / 1000, Date.parse(post.updated) / 1000);
            if (post.content)
            {
                const dt = new ADetail(article.id, post.content);
                output.details.push(dt);
            }
            output.articles.push(article);
            post.lastestLikers.forEach(theuser =>
            {
                const user = User.fromRawJson(theuser);
                output.users.push(user);
                output.zanarts.push(new Zan(user, article));
            });

            [post.meta.previous, post.meta.next].filter(p => p != null).forEach(p =>
            {
                const ath = User.fromRawJson(p.author);
                output.users.push(ath);
                output.topics.push(...p.topics.map(t => new Topic(t.id, t.name)));
                const subart = new Article(p.slug, p.title, ath.id, p.likesCount, p.summary.replace(/<[^>]+>/g, ""),
                    Date.parse(p.publishedTime) / 1000);//no updated time
                if (p.content)
                {
                    const dt = new ADetail(article.id, p.content);
                    output.details.push(dt);
                }
                output.articles.push(subart);
            });
        }

        console.log("artpage-report", output);
        ContentBase._report("batch", output);
    }

    function peopleEnhance()
    {
        $("body").on("click", ".Btn-AutoActSpider", async e =>
        {
            const thisbtn = e.target;
            const theuid = thisbtn.dataset.id;
            const lcount = e.shiftKey ? 270 : (e.ctrlKey ? 70 : 5);
            const ret = await ContentBase.fetchUserActs(theuid, lcount, undefined, undefined,
                (cur, time) => thisbtn.innerText = cur + "/" + Date.fromUTCSeconds(time).Format("MMdd"));
            const acts = ret.acts.selfMerge();
            thisbtn.innerText = (acts.zans.length + acts.zanarts.length) + "赞";
            ContentBase._report("batch", acts);
            console.log(acts);
        });

        const header = $("#ProfileHeader")[0];
        if (!header)
            return;
        const btn1 = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
        btn1.dataset.id = uid;
        btn1.dataset.type = "member";
        const btn2 = createButton(["Btn-StatVoter", "Button--primary"], "粉丝");
        btn2.dataset.id = uid;
        btn2.dataset.qname = "athid";
        const btn3 = createButton(["Btn-StatVoter", "Button--primary"], "赞谁");
        btn3.dataset.id = uid;
        btn3.dataset.qname = "uid";
        const btn4 = createButton(["Btn-AutoActSpider", "Button--primary"], "爬");
        btn4.dataset.id = uid;
        const btn5 = createButton(["Btn-ShowTime", "Button--primary"], "时间图");
        btn5.dataset.id = uid;
        btn5.dataset.qname = "uid";
        if (!header.hasChild(".ProfileButtonGroup"))
        {
            const dummydiv = document.createElement("div");
            dummydiv.className = "MemberButtonGroup ProfileButtonGroup ProfileHeader-buttons";
            $(".ProfileHeader-contentFooter", header).append(dummydiv);
        }
        $(".ProfileButtonGroup", header).prepend(btn1, btn2, btn3, btn4, btn5);
    }

    function qstEnhance()
    {
        const qstArea = $("div.QuestionHeader-footer-inner").find("div.QuestionButtonGroup")
        if (qstArea.length > 0)
        {
            const btn = createButton(["Btn-ReportSpam", "Button--primary"], "广告");
            btn.dataset.id = qid;
            btn.dataset.type = "question";
            const btn2 = createButton(["Btn-StatVoter", "Button--primary"], "最爱赞");
            btn2.dataset.id = qid;
            btn2.dataset.qname = "qid";
            const btn3 = createButton(["Btn-AssocAns", "Button--primary"], "启发");
            btn3.dataset.id = qid;
            btn3.dataset.qname = "qid";
            const btn4 = createButton(["Btn-ShowTime", "Button--primary"], "时间图");
            btn4.dataset.id = qid;
            btn4.dataset.qname = "qid";
            qstArea.prepend(btn);
            qstArea.prepend(btn2);
            qstArea.prepend(btn3);
            qstArea.prepend(btn4);
        }
        const qstHead = $(".QuestionHeader")[0];
        qstHead.ondragover = ev => ev.preventDefault();
        qstHead.ondrop = saveQuestion;
    }

}()


async function saveQuestion(ev)
{
    ev.preventDefault();
    /**@type {string}*/
    const txt = ev.dataTransfer.getData("text");
    if (txt != "MarkBtn") return;
    const qid = document.location.pathname.split("/")[2];
    if (!qid)
        return;
    const qsturl = `https://www.zhihu.com/api/v4/questions/${qid}?include=excerpt,content,author,answer_count,topics,comment_count,follower_count;data[*].author.voteup_count,answer_count,articles_count,follower_count,badge[?(type=best_answerer)].topics`
    const anspms = ContentBase.fetchAnswers(qid, 100);
    const qst = await ContentBase._get(qsturl);
    qst.answers = await anspms;

    const output = new StandardDB();
    qst.answers.forEach(ans => APIParser.parseByType(output, ans));
    APIParser.parseByType(output, qst);
    output.selfMerge();
    ContentBase._report("batch", output);

    const time = new Date().Format("yyyyMMdd-hhmm");
    const fname = `Question-${qid}-${time}.json`;
    console.log("question fetched", qst);
    if (!ev.ctrlKey)
    {
        return SendMsgAsync({ action: "download", data: qst, type: "json", fname: fname });
    }

    let imgset = new Set();
    qst.answers.forEach(ans =>
    {
        const mths = ans.content.match(/<img [^>]*>/g);
        if (!mths) return;
        mths.map(img => img.match(/data-original="([^"]*)"/i)).filter(mth => mth)
            .forEach(mth => imgset.add(mth[1]));
    });
    saveWithImg(qst, imgset, fname);
}

async function saveADetail(target, id)
{
    if (target === "article")
    {
        console.warn("not implemented");
        return;
    }
    const ansurl = `https://www.zhihu.com/api/v4/answers/${id}?include=excerpt,content,author,comment_count,voteup_count;data[*].question.answer_count,topics,follower_count;data[*].author.voteup_count,answer_count,articles_count,follower_count,badge[?(type=best_answerer)].topics`
    const ans = await ContentBase._get(ansurl);

    const output = new StandardDB();
    APIParser.parseByType(output, ans);
    ContentBase._report("batch", output);

    const time = new Date().Format("yyyyMMdd-hhmm");
    const fname = `Answer-${id}-${time}.json`;
    console.log("answer fetched", ans);

    let imgset = new Set();
    const mths = ans.content.match(/<img [^>]*>/g);
    if (mths)
        mths.map(img => img.match(/data-original="([^"]*)"/i)).filter(mth => mth)
            .forEach(mth => imgset.add(mth[1]));

    saveWithImg(ans, imgset, fname);
}

async function saveWithImg(base, imgset, fname)
{
    const imgs = imgset.toArray();
    console.log(imgs);
    let jsonpart = [JSON.stringify(base).slice(0, -1), ',"images":{'];//use raw string, avoid crash in JSON.stringify
    for (let idx = 0, pidx = 1; idx < imgs.length; idx += 50)//fetch 50 images at a time, avoid timeout and 409
    {
        if (idx > pidx * 300)//split to multiple part, avoid too large for a string
        {
            jsonpart.push('');
            pidx++;
        }
        await Promise.all(imgs.slice(idx, idx + 50)
            .map(async img =>
            {
                const b64 = await toBase64Img(fetch(img), img);
                const imgname = img.split("/").pop();
                jsonpart[pidx] += `"${imgname}":"${b64}",`;
            }));
        console.log("finish cycle", idx);
    }
    jsonpart[jsonpart.length - 1] = jsonpart[jsonpart.length - 1].slice(0, -1);
    jsonpart.push("}}");
    const blob = new Blob(jsonpart, { type: "application/json" });
    const dataurl = URL.createObjectURL(blob);
    console.log("data with images backuped", base);
    SendMsgAsync({ action: "download", data: dataurl, type: "ObjectURL", fname: fname });
}