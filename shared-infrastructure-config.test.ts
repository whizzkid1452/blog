import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sharedTemplatePath = path.join(process.cwd(), 'infra', 'shared-stack.yml');
const legacyEcsTemplatePath = path.join(process.cwd(), 'infra', 'ecs-stack.yml');
const ec2TemplatePath = path.join(process.cwd(), 'infra', 'ec2-stack.yml');
const readmePath = path.join(process.cwd(), 'README.md');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('AWS shared infrastructure cleanup', () => {
  it('keeps the existing ECR repository and GitHub OIDC provider', () => {
    const sharedTemplate = readFile(sharedTemplatePath);

    expect(sharedTemplate).toContain('ContainerRepository:');
    expect(sharedTemplate).toContain('RepositoryName: blog');
    expect(sharedTemplate).toContain('GitHubOidcProvider:');
    expect(sharedTemplate).toContain('Url: https://token.actions.githubusercontent.com');
  });

  it('removes ECS, ALB, and the previous deployment role from the retained stack', () => {
    const sharedTemplate = readFile(sharedTemplatePath);

    expect(sharedTemplate).not.toContain('AWS::ECS::');
    expect(sharedTemplate).not.toContain('AWS::ElasticLoadBalancingV2::');
    expect(sharedTemplate).not.toContain('AWS::Logs::LogGroup');
    expect(sharedTemplate).not.toContain('blog-deploy-role');
    expect(fs.existsSync(legacyEcsTemplatePath)).toBe(false);
  });

  it('describes ECR and GitHub OIDC as shared resources', () => {
    const ec2Template = readFile(ec2TemplatePath);

    expect(ec2Template).toContain('공유 스택에서 관리하는 GitHub OIDC 공급자 ARN');
    expect(ec2Template).toContain('공유 스택에서 관리하는 ECR 저장소 ARN');
    expect(ec2Template).not.toContain('기존 ECS 스택');
  });

  it('documents the current EC2 automatic deployment target', () => {
    const readme = readFile(readmePath);

    expect(readme).toContain('EC2 `t4g.small`');
    expect(readme).not.toContain('ECS Fargate 서비스를 자동 배포한다');
  });
});
