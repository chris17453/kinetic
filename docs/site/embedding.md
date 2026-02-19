# Embedding Reports

Kinetic reports can be embedded in any web application using a simple HTML snippet.

## Quick Start

### 1. Generate Embed Token

```bash
curl -X POST "https://kinetic.example.com/api/embed/tokens" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": "550e8400-e29b-41d4-a716-446655440000",
    "expiresInMinutes": 60
  }'
```

Response:
```json
{
  "token": "embed_abc123...",
  "expiresAt": "2024-01-15T13:00:00Z"
}
```

### 2. Add HTML Snippet

```html
<div id="kinetic-report"></div>
<script src="https://kinetic.example.com/embed/kinetic-embed.js"></script>
<script>
  KineticEmbed.render({
    container: '#kinetic-report',
    token: 'embed_abc123...',
  });
</script>
```

That's it! The report will render in the specified container.

## Configuration Options

```javascript
KineticEmbed.render({
  // Required
  container: '#kinetic-report',  // CSS selector or DOM element
  token: 'embed_abc123...',      // Embed token from API
  
  // Optional - Display
  width: '100%',                 // Container width
  height: '600px',               // Container height
  theme: 'light',                // 'light' or 'dark'
  
  // Optional - Features
  showParameters: true,          // Show parameter inputs
  showExport: true,              // Show export buttons
  showRefresh: true,             // Show refresh button
  showFullscreen: true,          // Show fullscreen button
  
  // Optional - Parameters
  parameters: {                  // Pre-fill parameters
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  },
  lockParameters: false,         // Prevent parameter editing
  
  // Optional - Auto-behavior
  autoRun: true,                 // Run report on load
  autoRefresh: 0,                // Auto-refresh interval (minutes, 0 = disabled)
  
  // Optional - Callbacks
  onLoad: function(report) {},   // Report loaded
  onExecute: function(result) {},// Report executed
  onError: function(error) {},   // Error occurred
  onExport: function(format) {}, // Export triggered
});
```

## Token Options

When generating tokens, you can restrict functionality:

```json
{
  "reportId": "guid",
  "expiresInMinutes": 60,
  "allowedDomains": ["example.com", "*.example.com"],
  "options": {
    "showParameters": true,
    "showExport": false,
    "showRefresh": true,
    "allowedExports": ["excel", "csv"],
    "maxExecutions": 100
  }
}
```

### Token Security

- Tokens are short-lived (configurable)
- Domain restrictions prevent unauthorized embedding
- Execution limits prevent abuse
- Tokens can be revoked programmatically

## Framework Examples

### React

```jsx
import { useEffect, useRef } from 'react';

function KineticReport({ token, parameters }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://kinetic.example.com/embed/kinetic-embed.js';
    script.onload = () => {
      window.KineticEmbed.render({
        container: containerRef.current,
        token,
        parameters,
        height: '500px',
      });
    };
    document.body.appendChild(script);
    
    return () => {
      window.KineticEmbed?.destroy(containerRef.current);
    };
  }, [token, parameters]);
  
  return <div ref={containerRef} />;
}
```

### Vue.js

```vue
<template>
  <div ref="container"></div>
</template>

<script>
export default {
  props: ['token', 'parameters'],
  mounted() {
    const script = document.createElement('script');
    script.src = 'https://kinetic.example.com/embed/kinetic-embed.js';
    script.onload = () => {
      window.KineticEmbed.render({
        container: this.$refs.container,
        token: this.token,
        parameters: this.parameters,
      });
    };
    document.body.appendChild(script);
  },
  beforeDestroy() {
    window.KineticEmbed?.destroy(this.$refs.container);
  },
};
</script>
```

### Angular

```typescript
import { Component, ElementRef, Input, OnInit, OnDestroy, ViewChild } from '@angular/core';

@Component({
  selector: 'kinetic-report',
  template: '<div #container></div>',
})
export class KineticReportComponent implements OnInit, OnDestroy {
  @ViewChild('container') container!: ElementRef;
  @Input() token!: string;
  @Input() parameters?: Record<string, any>;
  
  ngOnInit() {
    const script = document.createElement('script');
    script.src = 'https://kinetic.example.com/embed/kinetic-embed.js';
    script.onload = () => {
      (window as any).KineticEmbed.render({
        container: this.container.nativeElement,
        token: this.token,
        parameters: this.parameters,
      });
    };
    document.body.appendChild(script);
  }
  
  ngOnDestroy() {
    (window as any).KineticEmbed?.destroy(this.container.nativeElement);
  }
}
```

### Vanilla JavaScript (Module)

```javascript
import { KineticEmbed } from '@kinetic/embed';

const report = new KineticEmbed({
  container: '#report',
  token: 'embed_abc123...',
});

// Update parameters dynamically
report.setParameters({ startDate: '2024-02-01' });

// Execute manually
report.execute();

// Destroy when done
report.destroy();
```

## Responsive Design

The embed automatically handles responsive layouts:

```css
/* Container will fill parent width */
#kinetic-report {
  width: 100%;
  min-height: 400px;
  max-height: 800px;
}

/* On mobile, parameters collapse to a modal */
@media (max-width: 768px) {
  .kinetic-embed {
    --kinetic-parameter-mode: modal;
  }
}
```

## Styling

### CSS Variables

```css
.kinetic-embed {
  /* Colors */
  --kinetic-primary: #3B82F6;
  --kinetic-background: #FFFFFF;
  --kinetic-text: #1F2937;
  --kinetic-border: #E5E7EB;
  
  /* Typography */
  --kinetic-font-family: 'Inter', sans-serif;
  --kinetic-font-size: 14px;
  
  /* Spacing */
  --kinetic-spacing: 16px;
  --kinetic-border-radius: 8px;
}
```

### Theme Override

```javascript
KineticEmbed.render({
  container: '#report',
  token: 'embed_abc123...',
  theme: {
    primary: '#10B981',
    background: '#F9FAFB',
    text: '#111827',
    fontFamily: 'system-ui',
  },
});
```

## Server-Side Token Generation

### Node.js

```javascript
const jwt = require('jsonwebtoken');

function generateEmbedToken(reportId, userId, options = {}) {
  const payload = {
    sub: userId,
    reportId,
    type: 'embed',
    options: {
      showParameters: options.showParameters ?? true,
      showExport: options.showExport ?? true,
      ...options,
    },
  };
  
  return jwt.sign(payload, process.env.KINETIC_SECRET, {
    expiresIn: options.expiresIn || '1h',
    issuer: 'kinetic',
  });
}
```

### C#

```csharp
public string GenerateEmbedToken(Guid reportId, Guid userId, EmbedOptions options)
{
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
        new Claim("reportId", reportId.ToString()),
        new Claim("type", "embed"),
        new Claim("options", JsonSerializer.Serialize(options)),
    };
    
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Secret"]));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    
    var token = new JwtSecurityToken(
        issuer: "kinetic",
        audience: "kinetic-embed",
        claims: claims,
        expires: DateTime.UtcNow.AddHours(1),
        signingCredentials: creds
    );
    
    return new JwtSecurityTokenHandler().WriteToken(token);
}
```

## Events

Listen to embed events:

```javascript
const embed = KineticEmbed.render({
  container: '#report',
  token: 'embed_abc123...',
});

embed.on('load', (report) => {
  console.log('Report loaded:', report.name);
});

embed.on('execute', (result) => {
  console.log('Rows returned:', result.rowCount);
});

embed.on('error', (error) => {
  console.error('Error:', error.message);
  // Show custom error UI
});

embed.on('export', (format) => {
  analytics.track('report_exported', { format });
});

embed.on('parameterChange', (name, value) => {
  // Sync parameters with parent app
});
```

## Security Best Practices

1. **Short Token Expiry**: Use 1-hour tokens, refresh as needed
2. **Domain Restrictions**: Always specify allowed domains
3. **Execution Limits**: Set reasonable limits on executions
4. **Server-Side Generation**: Generate tokens server-side only
5. **HTTPS Only**: Embed only on HTTPS pages
6. **Content Security Policy**: Add Kinetic to your CSP
   ```
   frame-src https://kinetic.example.com;
   ```

## Troubleshooting

### Report Not Loading
- Verify token is valid and not expired
- Check domain is in allowed list
- Ensure container element exists
- Check browser console for errors

### CORS Issues
- Kinetic must whitelist your domain
- Check `allowedDomains` in token

### Performance
- Use `autoRun: false` for heavy reports
- Pre-filter data in reports
- Enable caching in report settings

### Mobile Issues
- Use responsive container
- Test with `showParameters: false` if space is limited
- Use fullscreen mode for complex reports
