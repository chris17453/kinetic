using Kinetic.Queue.Consumers;
using Kinetic.Queue.Services;
using MassTransit;
using Microsoft.Extensions.DependencyInjection;

namespace Kinetic.Queue;

public class KineticQueueOptions
{
    public bool RegisterConsumers { get; set; } = true;
    public bool RegisterScheduler { get; set; } = true;
}

public static class QueueServiceExtensions
{
    public static IServiceCollection AddKineticQueue(
        this IServiceCollection services,
        string rabbitMqConnectionString,
        Action<KineticQueueOptions>? configure = null)
    {
        var options = new KineticQueueOptions();
        configure?.Invoke(options);

        services.AddMassTransit(x =>
        {
            if (options.RegisterConsumers)
            {
                x.AddConsumer<ExecuteReportConsumer>();
                x.AddConsumer<ScheduledReportConsumer>();
                x.AddConsumer<TriggerScheduledReportsConsumer>();
                x.AddConsumer<EntraGroupSyncConsumer>();
                x.AddConsumer<AuditCleanupConsumer>();
                x.AddConsumer<TempDataCleanupConsumer>();
            }

            x.AddDelayedMessageScheduler();

            x.UsingRabbitMq((context, cfg) =>
            {
                cfg.Host(rabbitMqConnectionString);
                cfg.UseDelayedMessageScheduler();
                cfg.ConfigureEndpoints(context);
            });
        });

        if (options.RegisterScheduler)
        {
            services.AddHostedService<ScheduledJobsHostedService>();
        }

        return services;
    }
}
