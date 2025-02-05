async function fetchEuropePMCAuthors(doi) {
    if (!doi || doi === "#") return [];

    const apiUrl = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(doi)}&format=json`;

    try {
        const response = await fetch(apiUrl, { method: 'GET' });
        if (!response.ok) throw new Error(`Europe PMC error: ${response.status}`);

        const data = await response.json();
        const authorList = data?.resultList?.result?.[0]?.authorString || "";
        
        return authorList ? authorList.split(", ") : [];
    } catch (error) {
        console.warn(`Europe PMC failed for DOI: ${doi}`, error);
        return [];
    }
}

async function fetchCrossRefAuthors(doi) {
    if (!doi || doi === "#") return [];

    const apiUrl = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;

    try {
        const response = await fetch(apiUrl, { method: 'GET' });
        if (!response.ok) throw new Error(`CrossRef error: ${response.status}`);

        const data = await response.json();
        const authorList = data?.message?.author || [];

        return authorList.map(author => `${author.given} ${author.family}`).filter(name => name.trim() !== "");
    } catch (error) {
        console.warn(`CrossRef failed for DOI: ${doi}`, error);
        return [];
    }
}

async function fetchOrcidPublications(orcidId) {
    const url = `https://pub.orcid.org/v3.0/${orcidId}/works`;

    try {
        const response = await fetch(url, { 
            method: 'GET', 
            headers: { 'Accept': 'application/json' } 
        });
        if (!response.ok) throw new Error(`ORCID API error: ${response.status}`);

        const data = await response.json();
        return data.group || [];
    } catch (error) {
        console.warn(`ORCID fetch failed for ID: ${orcidId}`, error);
        return [];
    }
}

async function fetchPublications(orcidIds) {
    document.getElementById('publications').innerHTML = "<p>Loading publications...</p>";

    const publicationsMap = new Map();

    for (const orcidId of orcidIds) {
        const publications = await fetchOrcidPublications(orcidId);

        for (const publication of publications) {
            const workSummary = publication['work-summary'][0];
            const title = workSummary?.title?.title?.value || "Untitled";
            const year = workSummary?.['publication-date']?.year?.value || "N/A";
            const journal = workSummary?.['journal-title']?.value || "N/A";

            // Extract DOI
            let doi = "#";
            const externalIds = workSummary?.['external-ids']?.['external-id'] || [];
            for (const id of externalIds) {
                if (id?.['external-id-type'] === "doi") {
                    doi = id?.['external-id-value'] || "#";
                    break;
                }
            }

            // Fetch authors (parallel requests)
            let authors = await Promise.any([
                fetchCrossRefAuthors(doi),
                fetchEuropePMCAuthors(doi)
            ]).catch(() => []);

            if (authors.length === 0) {
                const contributors = workSummary?.contributors?.contributor || [];
                authors = contributors.map(contributor => {
                    return contributor?.['credit-name']?.value || `ORCID: ${contributor?.['contributor-orcid']?.path || "Unknown"}`;
                });
            }

            if (authors.length === 0) authors = ["Unknown"];

            // Highlight authors from ORCID list
            const highlightedAuthors = authors.map(name =>
                orcidIds.some(id => name.includes(id)) ? `<strong>${name}</strong>` : name
            );

            // Deduplicate entries
            const key = `${title}_${year}`;
            if (publicationsMap.has(key)) {
                let existing = publicationsMap.get(key);
                existing.authors = Array.from(new Set([...existing.authors.split(", "), ...highlightedAuthors])).join(", ");
                publicationsMap.set(key, existing);
            } else {
                publicationsMap.set(key, { title, year, journal, doi, authors: highlightedAuthors.join(", ") });
            }
        }
    }

    // Display publications
    const publicationsContainer = document.getElementById('publications');
    publicationsContainer.innerHTML = '';

    if (publicationsMap.size === 0) {
        publicationsContainer.innerHTML = "<p>No publications found.</p>";
        return;
    }

    publicationsMap.forEach(pub => {
        const publicationDiv = document.createElement('div');
        publicationDiv.classList.add('publication');

        publicationDiv.innerHTML = `
            <h3 style="font-size: 16px; margin-bottom: 5px;">
                <a href="https://doi.org/${pub.doi}" target="_blank">${pub.title}</a>
            </h3>
            <p style="font-size: 14px; margin: 2px 0;"><strong>Year:</strong> ${pub.year}</p>
            <p style="font-size: 14px; margin: 2px 0;"><strong>Journal:</strong> ${pub.journal}</p>
            <p style="font-size: 14px; margin: 2px 0;"><strong>Authors:</strong> ${pub.authors}</p>
        `;

        publicationsContainer.appendChild(publicationDiv);
    });
}

// List of ORCID IDs to pull from
const orcidList = ["0000-0002-6956-9188", "0000-0002-6011-7126"]; // Replace with actual ORCID IDs

// Load publications on page load
fetchPublications(orcidList);

