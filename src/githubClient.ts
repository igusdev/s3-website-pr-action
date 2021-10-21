import * as github from '@actions/github';

const { GITHUB_TOKEN } = process.env;

export default github.getOctokit(GITHUB_TOKEN as string, {
  previews: ['ant-man-preview', 'flash-preview'],
});
