using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DBExportor
{
    public static class Utils
    {
        public static ushort ToUshort(this string str, ushort defaultNum) => ushort.TryParse(str, out ushort ret) ? ret : defaultNum;

        public static void ModifyInplace<T>(this List<T> list, Func<T, T> modifier)
        {
            for (var i = 0; i < list.Count; ++i)
                list[i] = modifier(list[i]);
        }

    }
}
