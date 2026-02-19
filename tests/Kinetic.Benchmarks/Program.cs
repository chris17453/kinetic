using BenchmarkDotNet.Running;
using Kinetic.Benchmarks;

// Run all benchmarks
var summary = BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
