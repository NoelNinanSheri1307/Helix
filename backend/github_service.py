import os
import re
from dataclasses import dataclass

import httpx
from fastapi import HTTPException

GITHUB_REPO_URL_PATTERN = re.compile(
    r"^https://github\.com/([^/]+)/([^/]+)/?$"
)


@dataclass
class RepoMetadata:
    github_url: str
    repository_name: str
    owner: str
    description: str | None
    language: str | None
    stars: int
    forks: int
    github_id: str
    default_branch: str
    size_kb: int


def parse_github_url(url: str) -> tuple[str, str, str]:
    cleaned = url.strip()
    match = GITHUB_REPO_URL_PATTERN.match(cleaned)
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub repository URL",
        )

    owner, repo = match.group(1), match.group(2)
    normalized = f"https://github.com/{owner}/{repo}"
    return owner, repo, normalized


def fetch_github_repo(owner: str, repo: str) -> dict:
    headers = {"Accept": "application/vnd.github.v3+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                f"https://api.github.com/repos/{owner}/{repo}",
                headers=headers,
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="GitHub API Error")

    if response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="Repository does not exist",
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="GitHub API Error")

    return response.json()


def validate_and_fetch_metadata(url: str) -> RepoMetadata:
    owner, repo, normalized_url = parse_github_url(url)
    data = fetch_github_repo(owner, repo)

    if data.get("private"):
        raise HTTPException(
            status_code=403,
            detail="Repository must be public",
        )

    return RepoMetadata(
        github_url=normalized_url,
        repository_name=data["name"],
        owner=data["owner"]["login"],
        description=data.get("description"),
        language=data.get("language"),
        stars=data.get("stargazers_count", 0),
        forks=data.get("forks_count", 0),
        github_id=str(data["id"]),
        default_branch=data.get("default_branch") or "main",
        size_kb=data.get("size", 0),
    )
