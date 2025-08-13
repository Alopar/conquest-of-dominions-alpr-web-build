async function downloadFile(url, filename) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    const href = URL.createObjectURL(blob);
    a.href = href; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(href);
}

window.downloadFile = downloadFile;


