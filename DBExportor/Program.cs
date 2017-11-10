using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Reflection;

namespace DBExportor
{
    public class Program
    {
        public static ushort Port { get; private set; }
        public static string Auth { get; private set; } = "171109a";
        public static string Address { get; private set; }
        public static DirectoryInfo DBFolder { get; private set; }
        public static void Main(string[] args)
        {
            Port = (args.Where(p => p.StartsWith("-p")).LastOrDefault()?.Substring(2))
                .ToUshort(8913);
            var folderpath = args.Where(p => p.StartsWith("-d")).LastOrDefault();
            DBFolder = new DirectoryInfo(String.IsNullOrEmpty(folderpath) ? Directory.GetCurrentDirectory() : folderpath);
            BuildWebHost(args).Run();
        }

        public static IWebHost BuildWebHost(string[] args) =>
            WebHost.CreateDefaultBuilder()
                .UseStartup<Startup>()
                .UseKestrel(options =>
                {
                    options.Listen(IPAddress.Loopback, Port);
                    var addrByte = new List<byte>();
                    addrByte.AddRange(IPAddress.Loopback.GetAddressBytes());
                    addrByte.AddRange(new byte[] { (byte)(Port / 256), (byte)(Port % 256) });
                    Address = Convert.ToBase64String(addrByte.ToArray());
                    Auth = Address + Auth;
                    Console.WriteLine($"listen on 127.0.0.1:{Port}");
                    Console.WriteLine($"Address：{Address}");
                })
                .Build();
    }
}
