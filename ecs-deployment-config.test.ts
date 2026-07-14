import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const deploymentWorkflowPath = path.join(process.cwd(), '.github', 'workflows', 'deploy-ecs.yml');
const pullRequestWorkflowPath = path.join(process.cwd(), '.github', 'workflows', 'pr-review.yml');
const infrastructureTemplatePath = path.join(process.cwd(), 'infra', 'ecs-stack.yml');

function readDeploymentFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('ECS deployment configuration', () => {
  it('runs only when main is updated and requests a short-lived OIDC token', () => {
    const workflow = readDeploymentFile(deploymentWorkflowPath);

    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('aws-actions/configure-aws-credentials@v6');
    expect(workflow).not.toContain('AWS_ACCESS_KEY_ID');
  });

  it('tags each ECR image with the immutable commit SHA', () => {
    const workflow = readDeploymentFile(deploymentWorkflowPath);

    expect(workflow).toContain('IMAGE_TAG: ${{ github.sha }}');
    expect(workflow).toContain('aws-actions/amazon-ecr-login@v2');
    expect(workflow).toContain('docker push "$IMAGE_URI"');
  });

  it('deploys the rendered task definition and waits for ECS stability', () => {
    const workflow = readDeploymentFile(deploymentWorkflowPath);

    expect(workflow).toContain('aws-actions/amazon-ecs-render-task-definition@v1');
    expect(workflow).toContain('aws-actions/amazon-ecs-deploy-task-definition@v2');
    expect(workflow).toContain('aws ecs wait services-stable');
  });

  it('builds the production Docker image before a pull request can merge', () => {
    const pullRequestWorkflow = readDeploymentFile(pullRequestWorkflowPath);

    expect(pullRequestWorkflow).toContain('Docker 이미지 빌드');
    expect(pullRequestWorkflow).toContain(
      'docker build --build-arg NEXT_PUBLIC_SITE_URL=https://example.com --tag blog:pr .'
    );
  });

  it('limits the AWS deployment role to the main branch', () => {
    const infrastructureTemplate = readDeploymentFile(infrastructureTemplatePath);

    expect(infrastructureTemplate).toContain('repo:whizzkid1452/blog:ref:refs/heads/main');
    expect(infrastructureTemplate).toContain('sts:AssumeRoleWithWebIdentity');
  });

  it('routes HTTPS traffic to the container health endpoint', () => {
    const infrastructureTemplate = readDeploymentFile(infrastructureTemplatePath);

    expect(infrastructureTemplate).toContain('AWS::ElasticLoadBalancingV2::LoadBalancer');
    expect(infrastructureTemplate).toContain('Protocol: HTTPS');
    expect(infrastructureTemplate).toContain('HealthCheckPath: /api/health');
    expect(infrastructureTemplate).toContain('ContainerPort: 3000');
  });

  it('uses only EC2-supported ASCII characters in security group descriptions', () => {
    const infrastructureTemplate = readDeploymentFile(infrastructureTemplatePath);
    const groupDescriptions = infrastructureTemplate.match(/^\s+GroupDescription: (.+)$/gm) ?? [];

    expect(groupDescriptions.length).toBeGreaterThan(0);
    expect(groupDescriptions.every(description => /^[\x20-\x7E]+$/.test(description))).toBe(true);
  });
});
