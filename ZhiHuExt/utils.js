"use strict"

Array.prototype.addall = function (other)
{
    if ($.isArray(other))
        other.forEach(x => this.push(v));
    else
        console.warn("cannot add non-array to array", other);
}
Array.prototype.flatArray = function ()
{
    return Array.fromArrays(...this);
}
Array.fromArrays = function (...array)
{
    return [].concat.apply([], array);
}
Array.fromArray = function (array)
{
    if (array instanceof Array)
        return Array.fromArrays(...array);
    else
        return [array];
}
String.prototype.removeSuffix = function (count)
{
    var del = Math.min(this.length, count);
    return this.substring(0, this.length - del);
}