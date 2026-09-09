using Bios.Launcher;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class CommandLineOptionsTests
{
    [Theory]
    [InlineData(new string[0], false)]
    [InlineData(new[] { "--diagnostics" }, true)]
    [InlineData(new[] { "--Diagnostics" }, true)]
    [InlineData(new[] { "foo", "--diagnostics", "bar" }, true)]
    [InlineData(new[] { "--diag" }, false)]
    public void Parses_the_diagnostics_switch(string[] args, bool expected)
    {
        Assert.Equal(expected, CommandLineOptions.Parse(args).Diagnostics);
    }
}
