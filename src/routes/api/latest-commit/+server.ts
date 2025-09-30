import { json } from '@sveltejs/kit';
import { GITHUB_TOKEN } from '$env/static/private';

// This is the GET request handler for your new API endpoint
export async function GET() {
	const owner = 'SpikeyHunter';
	const repo = 'Produkt-App';
	const url = `https://api.github.com/repos/${owner}/${repo}/commits`;

	try {
		// Fetch data from the GitHub API
		const response = await fetch(url, {
			headers: {
				// Use your private token for authentication
				Authorization: `Bearer ${GITHUB_TOKEN}`,
				Accept: 'application/vnd.github.v3+json'
			}
		});

		if (!response.ok) {
			// If GitHub API returns an error, forward it
			return json({ error: `GitHub API Error: ${response.statusText}` }, { status: response.status });
		}

		const commits = await response.json();

		if (!commits || commits.length === 0) {
			return json({ error: 'No commits found in repository' }, { status: 404 });
		}

		// Get the most recent commit
		const latestCommit = commits[0].commit;

		// The commit message often contains a title and body, separated by two newlines
		const [title, ...bodyParts] = latestCommit.message.split('\n\n');
		const body = bodyParts.join('\n\n');

		// Send only the necessary data to the client
		const commitDetails = {
			title,
			body
		};

		return json(commitDetails);

	} catch (error) {
		console.error('Failed to fetch latest commit:', error);
		return json({ error: 'An internal server error occurred.' }, { status: 500 });
	}
}