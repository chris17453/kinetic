using Microsoft.Extensions.DependencyInjection;
using Kinetic.Adapters.Core;

namespace Kinetic.Adapters;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddKineticAdapters(this IServiceCollection services)
    {
        services.AddSingleton<IAdapterFactory, AdapterFactory>();
        return services;
    }
}
