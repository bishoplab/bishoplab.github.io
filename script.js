async function fetchPublications(orcidIds) {
    const publicationsMap = new Map(); // To track unique publications

    for (const orcidId of orcidIds) {
        const url = `https://pub.orcid.org/v3.0/${orcidId}/works`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            const publications = data.group;

            publications.forEach(publication => {
                const workSummary = publication['work-summary'][0];
                const title = workSummary?.title?.title?.value || "Untitled";
                const year = workSummary?.['publication-date']?.year?.value || "N/A";
                const journal = workSummary?.['journal-title']?.value || "N/A";

                // Extract DOI or first available external link
                let doi = "#";
                const externalIds = workSummary?.['external-ids']?.['external-id'] || [];
                if (externalIds.length > 0) {
                    doi = externalIds[0]?.['external-id-url']?.value || "#";
                }

                // Extract authors and bold the ORCID-linked ones
                let authors = (workSummary?.['contributors']?.['contributor'] || []).map(contributor => {
                    let authorName = contributor?.['credit-name']?.value || "Unknown Author";
                    return orcidIds.includes(contributor?.['contributor-orcid']?.path) 
                        ? `<strong>${authorName}</strong>` 
                        : authorName;
                }).join(", ");

                // Generate unique key for deduplication (Title + Year)
                const key = `${title}_${year}`;

                if (publicationsMap.has(key)) {
                    // Merge authors if duplicate
                    let existingData = publicationsMap.get(key);
                    existingData.authors = Array.from(new Set([...existingData.authors.split(", "), ...authors.split(", ")])).join(", ");
                    publicationsMap.set(key, existingData);
                } else {
                    publicationsMap.set(key, { title, year, journal, doi, authors });
                }
            });

        } catch (error) {
            console.error('Error fetching data from ORCID API', error);
            document.getElementById('publications').innerHTML = '<p>Failed to load publications.</p>';
        }
    }

    // Display publications
    const publicationsContainer = document.getElementById('publications');
    publicationsContainer.innerHTML = ''; // Clear previous content

    publicationsMap.forEach(pub => {
        const publicationDiv = document.createElement('div');
        publicationDiv.classList.add('publication');

        publicationDiv.innerHTML = `
            <h3 style="font-size: 16px; margin-bottom: 5px; margin-top: 5px;">
                <a href="${pub.doi}" target="_blank">${pub.title}</a>
            </h3>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Year:</strong> ${pub.year}</p>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Journal:</strong> ${pub.journal}</p>
            <p style="font-size: 12px; margin: 2px 0;"><strong>Authors:</strong> ${pub.authors}</p>
        `;

        publicationsContainer.appendChild(publicationDiv);
    });
}

// List of ORCID IDs to pull from
const orcidList = ["0000-0002-6956-9188", "0000-0002-6011-7126"]; // Replace with actual ORCID IDs

// Load publications on page load
fetchPublications(orcidList);
