import { supabase } from './supabase';
import type { Property, ExerciseYear, FixedExpenses, ConsumptionData, Note } from '../types';

// Properties
export const getProperties = async () => {
  const { data, error } = await supabase.from('properties').select('*').order('name');
  if (error) throw error;
  return data as Property[];
};

export const createProperty = async (name: string, address: string) => {
  const { data, error } = await supabase.from('properties').insert({ name, address }).select().single();
  if (error) throw error;
  return data as Property;
};

export const updateProperty = async (id: string, name: string, address: string) => {
  const { error } = await supabase.from('properties').update({ name, address }).eq('id', id);
  if (error) throw error;
};

export const deleteProperty = async (id: string) => {
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw error;
};

// Exercise Years
export const getExerciseYears = async (propertyId: string) => {
  const { data, error } = await supabase.from('exercise_years').select('*').eq('property_id', propertyId).order('year_label');
  if (error) throw error;
  return data as ExerciseYear[];
};

export const upsertExerciseYear = async (record: Omit<ExerciseYear, 'id' | 'created_at'> & { id?: string }) => {
  const { data, error } = await supabase.from('exercise_years').upsert(record).select().single();
  if (error) throw error;
  return data as ExerciseYear;
};

export const deleteExerciseYear = async (id: string) => {
  const { error } = await supabase.from('exercise_years').delete().eq('id', id);
  if (error) throw error;
};

// Fixed Expenses
export const getFixedExpenses = async (propertyId: string) => {
  const { data, error } = await supabase.from('fixed_expenses').select('*').eq('property_id', propertyId).order('year_label');
  if (error) throw error;
  return data as FixedExpenses[];
};

export const upsertFixedExpenses = async (record: Omit<FixedExpenses, 'id' | 'created_at'> & { id?: string }) => {
  const { data, error } = await supabase.from('fixed_expenses').upsert(record).select().single();
  if (error) throw error;
  return data as FixedExpenses;
};

export const deleteFixedExpenses = async (id: string) => {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
  if (error) throw error;
};

// Consumption
export const getConsumptionData = async (propertyId: string) => {
  const { data, error } = await supabase.from('consumption_data').select('*').eq('property_id', propertyId).order('year_label');
  if (error) throw error;
  return data as ConsumptionData[];
};

export const upsertConsumptionData = async (record: Omit<ConsumptionData, 'id' | 'created_at'> & { id?: string }) => {
  const { data, error } = await supabase.from('consumption_data').upsert(record).select().single();
  if (error) throw error;
  return data as ConsumptionData;
};

export const deleteConsumptionData = async (id: string) => {
  const { error } = await supabase.from('consumption_data').delete().eq('id', id);
  if (error) throw error;
};

// Notes
export const getNotes = async (propertyId: string) => {
  const { data, error } = await supabase.from('notes').select('*').eq('property_id', propertyId).order('created_at', { ascending: false });
  if (error) throw error;
  return data as Note[];
};

export const upsertNote = async (record: Omit<Note, 'id' | 'created_at'> & { id?: string }) => {
  const { data, error } = await supabase.from('notes').upsert(record).select().single();
  if (error) throw error;
  return data as Note;
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
};
