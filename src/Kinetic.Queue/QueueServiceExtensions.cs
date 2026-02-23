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
            x.AddConsumer<ExecuteReportConsumer>();
            x.AddConsumer<ScheduledReportConsumer>();
            x.AddConsumer<TriggerScheduledReportsConsumer>();
            x.AddConsumer<EntraGroupSyncConsumer>();
            x.AddConsumer<AuditCleanupConsumer>();
            x.AddConsumer<TempDataCleanupConsumer>();

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

        services.AddHostedService<ScheduledJobsHostedService>();

        return services;
    }
}
