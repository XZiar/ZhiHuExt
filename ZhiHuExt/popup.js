function rfs()
{
    chrome.runtime.sendMessage({ action: "stat" }, function(data)
    {
        if (data == null)
        {
            console.log("callback get error", chrome.runtime.lastError);
            return;
        }
        console.log(data);
        var objtab = $("#stat");
        objtab.empty();
        Object.keys(data).forEach((name) =>
        {
            var row = "<tr><td width='40%'>" + name + "</td><td>" + data[name] + "</td></tr>";
            objtab.append(row);
        });
    });
}

$(document).on("click", "button#rfs", rfs);
$(document).on("click", "button#spider", () =>
{
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: "AutoSpider.html" });
});
$(document).on("click", "button#send", () =>
{
    chrome.runtime.sendMessage({ action: "openpage", isBackground: false, target: "Export.html" });
});
$(document).ready(() =>
{
    //rfs();
});
