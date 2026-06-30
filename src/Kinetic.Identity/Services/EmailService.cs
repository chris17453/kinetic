using System.Net;
using System.Net.Mail;
using Kinetic.Identity.Configuration;

namespace Kinetic.Identity.Services;

public interface IEmailService
{
    bool IsConfigured { get; }
    Task SendPasswordResetEmailAsync(string toEmail, string resetUrl);
    Task SendTestEmailAsync(string toEmail);
}

public class EmailService : IEmailService
{
    private readonly SmtpSettings _settings;

    public EmailService(SmtpSettings settings)
    {
        _settings = settings;
    }

    public bool IsConfigured => !string.IsNullOrEmpty(_settings.Host);

    public async Task SendPasswordResetEmailAsync(string toEmail, string resetUrl)
    {
        var subject = "Reset your Kinetic password";
        var body = $"""
            <!DOCTYPE html>
            <html>
            <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;">
              <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
                <div style="background:linear-gradient(135deg,#0d6efd,#6610f2);padding:32px;text-align:center;">
                  <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Kinetic</h1>
                </div>
                <div style="padding:32px;">
                  <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#212529;">Reset your password</h2>
                  <p style="margin:0 0 24px;color:#6c757d;font-size:14px;line-height:1.5;">
                    We received a request to reset the password for your account. Click the button below to choose a new password.
                  </p>
                  <div style="text-align:center;margin:0 0 24px;">
                    <a href="{resetUrl}" style="display:inline-block;padding:12px 32px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
                      Reset Password
                    </a>
                  </div>
                  <p style="margin:0 0 8px;color:#6c757d;font-size:13px;line-height:1.5;">
                    This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                  </p>
                  <hr style="border:none;border-top:1px solid #e9ecef;margin:24px 0;" />
                  <p style="margin:0;color:#adb5bd;font-size:12px;">
                    If the button doesn't work, copy and paste this URL into your browser:<br/>
                    <a href="{resetUrl}" style="color:#0d6efd;word-break:break-all;">{resetUrl}</a>
                  </p>
                </div>
              </div>
            </body>
            </html>
            """;

        await SendAsync(toEmail, subject, body);
    }

    public async Task SendTestEmailAsync(string toEmail)
    {
        var subject = "Kinetic SMTP Test";
        var body = """
            <!DOCTYPE html>
            <html>
            <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <div style="max-width:520px;margin:40px auto;padding:32px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#198754;">SMTP Configuration Successful</h2>
                <p style="margin:0;color:#6c757d;font-size:14px;">
                  Your Kinetic email settings are working correctly. You can now use features like password reset emails.
                </p>
              </div>
            </body>
            </html>
            """;

        await SendAsync(toEmail, subject, body);
    }

    private async Task SendAsync(string toEmail, string subject, string htmlBody)
    {
        using var message = new MailMessage();
        message.From = new MailAddress(_settings.FromAddress, _settings.FromName);
        message.To.Add(toEmail);
        message.Subject = subject;
        message.Body = htmlBody;
        message.IsBodyHtml = true;

        using var client = new SmtpClient(_settings.Host, _settings.Port);
        client.EnableSsl = _settings.UseSsl;
        if (!string.IsNullOrEmpty(_settings.Username))
        {
            client.Credentials = new NetworkCredential(_settings.Username, _settings.Password);
        }
        await client.SendMailAsync(message);
    }
}
