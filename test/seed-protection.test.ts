import assert from 'node:assert/strict';
import {test} from 'node:test';
import {keepReviewedRobot} from '../lib/seed-importer';
test('seed sync preserves reviewed and company-approved robot revisions',()=>{
  assert.ok(keepReviewedRobot({companySubmission:{id:'reviewed-submission'}}));
  assert.ok(keepReviewedRobot({sourceReview:{status:'partial'}}));
  for(const meta of [null,[],{}, {category:'robot_model'}]) assert.equal(keepReviewedRobot(meta),false);
});
