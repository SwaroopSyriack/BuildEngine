

function projSumamry(project) {
    return {
        id: project.id,
        user_id: project.user_id,
        name: project.name,
        repoUrl: project.repo_url,
        buildCommand: project.build_command,
        buildImage: project.build_image,
        outputDir: project.output_dir,
        spaFallback: !!project.spa_fallback,
        createdAt: project.created_at,
    };
}

function deploySummary(d) {

    return {
        id: d.id,
        projectId: d.project_id,
        repoUrl: d.repo_url,
        buildCommand: d.build_command,
        buildImage: d.build_image,
        commitSha: d.commit_sha,
        status: d.status,
        claimedBy: d.claimed_by,
        claimedAt: d.claimed_at,
        startedAt: d.started_at,
        finishedAt: d.finished_at,
        outputDir: d.output_dir,
        storagePath: d.storage_path,
        errorMessage: d.error_message,
        createdAt: d.created_at,

    }

}


function userSummary(u) {

    return {
        user_id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.created_at
    }


}

export { projSumamry, deploySummary, userSummary };
