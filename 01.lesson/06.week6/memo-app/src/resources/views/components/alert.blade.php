@props(['type' => 'info'])

@php
    $colors = ['success' => '#2e7d32', 'danger' => '#c62828', 'info' => '#1565c0'];
@endphp

<div style="border-left: 4px solid {{ $colors[$type] ?? $colors['info'] }}; padding: 8px 12px; margin: 8px 0;">
    {{ $slot }}
</div>