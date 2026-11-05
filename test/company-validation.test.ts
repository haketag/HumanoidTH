import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commandSchema, credentials, publicUrl, researchData, robotData, companyKey } from '../lib/company-validation';

test('company inputs reject mass assignment, malicious URLs, forged roles and invalid DOI',()=>{
  assert.equal(credentials.safeParse({email:'a@example.com',password:'long-password-123',role:'ADMIN'}).success,false);
  for(const value of ['javascript:alert(1)','data:text/html,hello','file:///etc/passwd','http://127.0.0.1/a','http://localhost/a','https://user:pass@example.com','http://[::1]/a']) assert.equal(publicUrl(value),false,value);
  assert.equal(publicUrl('https://example.com/products/a'),true);
  assert.equal(commandSchema.safeParse({action:'publish',role:'ADMIN'}).success,false);
  assert.equal(commandSchema.safeParse({action:'submit',id:'x',version:1,userId:'someone-else'}).success,false);
  const research={title:'Actual paper reference',authors:'Authors from original',description:'An actual source description',sourceUrl:'https://example.com/paper',documentType:'research_paper'};
  assert.equal(researchData.safeParse({...research,doi:'not-a-doi'}).success,false);
  assert.equal(researchData.safeParse({...research,robotId:'robot'}).success,false);
  assert.equal(researchData.safeParse({...research,robotId:'robot',relationshipEvidence:'https://example.com/evidence'}).success,true);
  assert.equal(robotData.safeParse({name:'Robot',description:'A description from a source',robotType:'service',officialUrl:'https://example.com',sources:[],imageUrl:'https://example.com/payload.svg'}).success,false);
  assert.equal(robotData.safeParse({name:'Robot',description:'A description from a source',robotType:'service',officialUrl:'https://example.com',sources:['https://example.com'],imageUrl:''}).success,true);
  assert.equal(companyKey('  Example   COMPANY '),'example company');
});
