$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://*:8000/')
$listener.Start()
Write-Host 'Server started at http://localhost:8000'
Write-Host 'On your phone, navigate to http://192.168.0.124:8000'

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $filePath = '.' + $request.Url.LocalPath
    if ($filePath -eq './') {
        $filePath = './index.html'
    }

    $extension = [System.IO.Path]::GetExtension($filePath)
    $contentType = 'text/plain'

    switch ($extension) {
        '.html' { $contentType = 'text/html' }
        '.css' { $contentType = 'text/css' }
        '.js' { $contentType = 'application/javascript' }
        '.json' { $contentType = 'application/json' }
        '.png' { $contentType = 'image/png' }
        '.jpg' { $contentType = 'image/jpeg' }
        '.gif' { $contentType = 'image/gif' }
        '.svg' { $contentType = 'image/svg+xml' }
    }

    try {
        $content = Get-Content -Path $filePath -Encoding Byte -ReadCount 0
        $response.ContentType = $contentType
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
    } catch {
        $response.StatusCode = 404
        $content = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $response.ContentLength64 = $content.Length
        $response.OutputStream.Write($content, 0, $content.Length)
    }

    $response.Close()
}

$listener.Stop()
$listener.Close()