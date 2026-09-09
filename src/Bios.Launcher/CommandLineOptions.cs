namespace Bios.Launcher;

/// <summary>Parsed launcher command-line switches.</summary>
public sealed record CommandLineOptions(bool Diagnostics)
{
    public static CommandLineOptions Parse(string[] args)
    {
        var diagnostics = args.Any(a =>
            string.Equals(a, "--diagnostics", StringComparison.OrdinalIgnoreCase));

        return new CommandLineOptions(diagnostics);
    }
}
