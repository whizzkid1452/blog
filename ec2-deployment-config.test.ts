import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const deploymentWorkflowPath = path.join(process.cwd(), '.github', 'workflows', 'deploy-ec2.yml');
const infrastructureTemplatePath = path.join(process.cwd(), 'infra', 'ec2-stack.yml');
const deploymentScriptPath = path.join(process.cwd(), 'infra', 'deploy-ec2.sh');

function readDeploymentFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('EC2 deployment foundation', () => {
  it('keeps the EC2 deployment manual until the production cutover', () => {
    const workflow = readDeploymentFile(deploymentWorkflowPath);

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('push:');
    expect(workflow).toContain('id-token: write');
    expect(workflow).not.toContain('AWS_ACCESS_KEY_ID');
  });

  it('builds an immutable ARM64 image for the Graviton instance', () => {
    const workflow = readDeploymentFile(deploymentWorkflowPath);

    expect(workflow).toContain('docker/setup-qemu-action@v3');
    expect(workflow).toContain('docker/setup-buildx-action@v3');
    expect(workflow).toContain('IMAGE_TAG: ${{ github.sha }}');
    expect(workflow).toContain('--platform linux/arm64');
  });

  it('deploys through Systems Manager without an SSH key', () => {
    const workflow = readDeploymentFile(deploymentWorkflowPath);

    expect(workflow).toContain('aws ssm send-command');
    expect(workflow).toContain('aws ssm wait command-executed');
    expect(workflow).not.toContain('ssh ');
    expect(workflow).not.toContain('EC2_SSH_PRIVATE_KEY');
  });

  it('creates one ARM-based t4g.small instance with persistent addressing', () => {
    const infrastructureTemplate = readDeploymentFile(infrastructureTemplatePath);

    expect(infrastructureTemplate).toContain('Default: t4g.small');
    expect(infrastructureTemplate).toContain('al2023-ami-kernel-default-arm64');
    expect(infrastructureTemplate).toContain('VolumeType: gp3');
    expect(infrastructureTemplate).toContain('VolumeSize: 20');
    expect(infrastructureTemplate).toContain('AWS::EC2::EIP');
  });

  it('allows public web traffic but does not expose SSH', () => {
    const infrastructureTemplate = readDeploymentFile(infrastructureTemplatePath);

    expect(infrastructureTemplate).toContain('FromPort: 80');
    expect(infrastructureTemplate).toContain('FromPort: 443');
    expect(infrastructureTemplate).not.toContain('FromPort: 22');
    expect(infrastructureTemplate).toContain('AmazonSSMManagedInstanceCore');
  });

  it('checks the new container and restores the previous image on failure', () => {
    const deploymentScript = readDeploymentFile(deploymentScriptPath);

    expect(deploymentScript).toContain('http://127.0.0.1:3000/api/health');
    expect(deploymentScript).toContain('previousImage');
    expect(deploymentScript).toContain('restorePreviousContainer');
  });

  it('uses only EC2-supported ASCII characters in security group descriptions', () => {
    const infrastructureTemplate = readDeploymentFile(infrastructureTemplatePath);
    const groupDescriptions = infrastructureTemplate.match(/^\s+GroupDescription: (.+)$/gm) ?? [];

    expect(groupDescriptions.length).toBeGreaterThan(0);
    expect(groupDescriptions.every(description => /^[\x20-\x7E]+$/.test(description))).toBe(true);
  });
});
