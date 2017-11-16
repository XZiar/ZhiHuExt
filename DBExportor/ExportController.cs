using DBExportor.Pods;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace DBExportor.Controllers
{
    [Route("export")]
    public class ExportController : ControllerBase
    {
        private readonly ILogger<ExportController> LOG;

        public ExportController(ILogger<ExportController> logger)
        {
            LOG = logger;
        }

        [HttpGet("begin")]
        public IActionResult BeginDB()
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!NewDB(new StandardDB()))
                return StatusCode(500);
            return Ok("ok");
        }

        [HttpGet("finish")]
        public IActionResult OutputDB([FromQuery]bool shouldKeep = false)
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!TryGetDB(out var obj))
                return StatusCode(404);
            var fname = $"{Program.DBFolder}/ZhiHuExtDB-{ObjName}.json";
            using (StreamWriter file = System.IO.File.CreateText(fname))
            {
                Serializer.Serialize(file, obj);
                LOG.LogInformation("output DB successful", fname);
                if (!shouldKeep)
                    DelDB();
                return Ok("ok");
            }
        }

        [HttpPost("accept")]
        public IActionResult AcceptRecords([FromQuery]string table)
        {
            if (!CheckAuth())
                return StatusCode(401);
            if (!TryGetDB(out var db))
                return StatusCode(404);
            if (!DBExtensions.PodTypeMap.TryGetValue(table, out var tableinfo))
                return StatusCode(400);

            using (var reader = new JsonTextReader(new StreamReader(HttpContext.Request.Body)))
            {
                try
                {
                    dynamic records = Serializer.Deserialize(reader, tableinfo.ListType);
                    tableinfo.GetTable(db).AddRange(records);
                }
                catch(Exception e)
                {
                    LOG.LogError(e.Message);
                }
            }
            GC.Collect(2, GCCollectionMode.Optimized, false, true);
            return Ok("ok");
        }

        [HttpGet("breakpoint")]
        public void BreakPoint()
        {
            Console.WriteLine($"[break]{DBList}");
        }
    }
}
