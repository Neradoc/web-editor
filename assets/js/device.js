// Boot strap load everything from code.circuitpython.org
let SITE = "https://code.circuitpython.org"

async function fetchLocation(location, options = {}) {
    let fetchOptions = {
        ...options
    }

    const response = await fetch(new URL(location, SITE), fetchOptions);

    if (!response.ok) {
        throw new Error(response.statusText);
    }

    return response.text();
}

function replaceAssetLinks(code) {
    code = code.replace(/(href|src)="(assets\/.*?)"/gmi, (all, a, b) => {
        return `${a}="${SITE}/${b}"`
    });
    code = code.replace(/srcset="(.*? 1x)(,\n?\s*)(.*? 2x)(,\n?\s*)(.*? 3x)"/gmi, (all, a, b, c, d, e) => {
        return `srcset="${SITE}/${a}${b}${SITE}/${c}${d}${SITE}/${e}"`
    });

    return code;
}

// Fetch the HTML
let html = await fetchLocation("/");

// Replace any relative asset links with absolute links
html = replaceAssetLinks(await fetchLocation("/"));

// Put the HTML into the document
document.body.innerHTML = html;

// Get the scripts
let scriptElements = document.getElementsByTagName("script");
for (let script of scriptElements) {
    // We're only running external scripts
    if (!script.src || !script.src.startsWith(SITE)) {
        continue;
    }
    // Create a replacement for it
    let newScript = document.createElement('script');
    newScript.src = script.src;
    if (script.type) {
        newScript.type = script.type;
    }

    // Remove the existing script from the DOM and Start the script
    script.parentNode.removeChild(script);
    document.documentElement.appendChild(newScript);
}