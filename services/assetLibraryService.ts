import { AssetLibraryItem, Character, ProjectState, Prop, Scene } from '../types';

const generateId = (prefix: string): string => {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
};

const cloneCharacterVariation = (variation: Character['variations'][number]) => {
  const status: Character['variations'][number]['status'] = variation.referenceImage ? 'completed' : 'pending';
  return {
    ...variation,
    id: generateId('var'),
    status
  };
};

export const createLibraryItemFromCharacter = (
  character: Character,
  project?: Pick<ProjectState, 'id' | 'title'>
): AssetLibraryItem => {
  const now = Date.now();
  return {
    id: generateId('asset'),
    type: 'character',
    name: character.name,
    projectId: project?.id,
    projectName: project?.title,
    createdAt: now,
    updatedAt: now,
    data: {
      ...character,
      variations: (character.variations || []).map((v) => ({ ...v }))
    }
  };
};

export const createLibraryItemFromScene = (
  scene: Scene,
  project?: Pick<ProjectState, 'id' | 'title'>
): AssetLibraryItem => {
  const now = Date.now();
  return {
    id: generateId('asset'),
    type: 'scene',
    name: scene.location,
    projectId: project?.id,
    projectName: project?.title,
    createdAt: now,
    updatedAt: now,
    data: { ...scene }
  };
};

export const cloneCharacterForProject = (character: Character): Character => {
  const status: Character['status'] = character.referenceImage ? 'completed' : 'pending';
  return {
    ...character,
    id: generateId('char'),
    variations: (character.variations || []).map(cloneCharacterVariation),
    status
  };
};

export const cloneSceneForProject = (scene: Scene): Scene => {
  const status: Scene['status'] = scene.referenceImage ? 'completed' : 'pending';
  return {
    ...scene,
    id: generateId('scene'),
    status
  };
};

export const createLibraryItemFromProp = (
  prop: Prop,
  project?: Pick<ProjectState, 'id' | 'title'>
): AssetLibraryItem => {
  const now = Date.now();
  return {
    id: generateId('asset'),
    type: 'prop',
    name: prop.name,
    projectId: project?.id,
    projectName: project?.title,
    createdAt: now,
    updatedAt: now,
    data: { ...prop }
  };
};

export const clonePropForProject = (prop: Prop): Prop => {
  const status: Prop['status'] = prop.referenceImage ? 'completed' : 'pending';
  return {
    ...prop,
    id: generateId('prop'),
    status
  };
};

export const applyLibraryItemToProject = (project: ProjectState, item: AssetLibraryItem): ProjectState => {
  if (!project.scriptData) {
    throw new Error('项目尚未生成角色和场景，无法导入资产。');
  }

  const newData = { ...project.scriptData };

  if (item.type === 'character') {
    const character = cloneCharacterForProject(item.data as Character);
    newData.characters = [...newData.characters, character];
  } else if (item.type === 'scene') {
    const scene = cloneSceneForProject(item.data as Scene);
    newData.scenes = [...newData.scenes, scene];
  } else if (item.type === 'prop') {
    const prop = clonePropForProject(item.data as Prop);
    newData.props = [...(newData.props || []), prop];
  }

  return {
    ...project,
    scriptData: newData
  };
};
