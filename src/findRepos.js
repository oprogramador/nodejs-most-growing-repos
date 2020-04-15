#!/usr/bin/env node
const _ = require('lodash');
const bluebird = require('bluebird');
const request = require('superagent');
const countStars = require('github-star-history').default;
const fs = require('fs');

const token = process.env.GITHUB_TOKEN;
const date = '2019-01-01T00:00:00Z';
const categories = [
  'audio',
  'cache',
  'database',
  'docker',
  'event',
  'file',
  'framework',
  'graphql',
  'image',
  'library',
  'lint',
  'logging',
  'mail',
  'number',
  'odm',
  'orm',
  'queue',
  'sort',
  'string',
  'template',
  'test',
  'time',
  'typescript',
  'validation',
  'websocket',
];

const retrieveOnePage = category => request('https://api.github.com/search/repositories')
  .query({
    q: `"${category}" language:JavaScript language:TypeScript`,
    sort: 'stars',
  })
  .set('Authorization', `token ${token}`)
  .set('user-agent', 'script')
  .then(({ body }) => body.items
    .map(item => _.pick(
      item,
      'full_name',
      'description',
      'stargazers_count',
      'language',
    ))
    .filter(item => item.stargazers_count < 39990))
  .catch(async (error) => {
    console.error(error.response.error);
    await bluebird.delay(3000);

    return retrieveOnePage(category);
  });

const findRepos = retrieveOnePage;

(async () => {
  const result = _.zipObject(
    categories,
    await bluebird.mapSeries(categories, async (category, categoryIndex) => {
      console.log('starting searching repos in category', category, '(', categoryIndex, '/', categories.length, ')');
      const repos = await findRepos(category);
      console.log('repos', repos);

      const categoryResult = await bluebird.mapSeries(repos, async (repo, repoIndex) => {
        // eslint-disable-next-line max-len
        console.log('starting counting past stars for repo', repo.full_name, '(', repoIndex, '/', repos.length, '), category:', category, '(', categoryIndex, '/', categories.length, ')');
        const pastStars = await countStars(repo.full_name, date);

        return {
          ...repo,
          pastStars,
          starDifference: repo.stargazers_count - pastStars,
          starQuotient: repo.stargazers_count / pastStars,
        };
      });

      const reposSortedByStarDifference = _.sortBy(categoryResult, repo => -repo.starDifference);
      const reposSortedByStarQuotient = _.sortBy(categoryResult, repo => -repo.starQuotient);
      const enhancedCategoryResult = {
        reposSortedByStarDifference,
        reposSortedByStarQuotient,
      };
      console.log('result for category', category, JSON.stringify(enhancedCategoryResult));
      fs.writeFileSync(`category-${category}.json`, JSON.stringify(enhancedCategoryResult));

      return enhancedCategoryResult;
    }),
  );
  fs.writeFileSync('all.json', JSON.stringify(result));
  console.log(JSON.stringify(result));
})();
