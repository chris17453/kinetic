using Kinetic.Queue.Consumers;
using Kinetic.Queue.Services;
using MassTransit;
using Microsoft.Extensions.DependencyInjection;

namespace Kinetic.Queue;

public static class QueueServiceExtensions
{
    public static IServiceCollection AddKineticQueue(this IServiceCollection services, string redisConnectionString)
    {
        services.AddMassTransit(x =>
        {
            // These consumers depend on legacy services that are not registered for
            // the local-first API host. Keep MassTransit available for publishing
            // without making unfinished integrations block startup.
            // x.AddConsumer<ExecuteReportConsumer>();
            // x.AddConsumer<ScheduledReportConsumer>();
            // x.AddConsumer<TriggerScheduledReportsConsumer>();
            // x.AddConsumer<EntraGroupSyncConsumer>();
            // x.AddConsumer<AuditCleanupConsumer>();
            // x.AddConsumer<TempDataCleanupConsumer>();

            x.UsingInMemory((context, cfg) =>
            {
                cfg.ConfigureEndpoints(context);
            });

            // For production with Redis:
            // x.AddDelayedMessageScheduler();
            // x.UsingRedis((context, cfg) =>
            // {
            //     cfg.Host(redisConnectionString);
            //     cfg.UseDelayedMessageScheduler();
            //     cfg.ConfigureEndpoints(context);
            // });
        });

        return services;
    }
}
