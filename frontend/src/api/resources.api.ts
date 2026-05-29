import { http } from './http';

export const api = {
  organizations: {
    list: async () => (await http.get('/organizations')).data,
    summary: async () => (await http.get('/organizations/summary')).data,
    create: async (payload: any) => (await http.post('/organizations', payload)).data,
    update: async (id: string, payload: any) => (await http.put(`/organizations/${id}`, payload)).data,
    uploadBrandImage: async (id: string, form: FormData) => (await http.post(`/organizations/${id}/brand-image`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    remove: async (id: string) => (await http.delete(`/organizations/${id}`)).data
  },
  sectors: {
    list: async (params: any = {}) => (await http.get('/sectors', { params })).data,
    create: async (payload: any) => (await http.post('/sectors', payload)).data,
    update: async (id: string, payload: any) => (await http.put(`/sectors/${id}`, payload)).data,
    remove: async (id: string) => (await http.delete(`/sectors/${id}`)).data
  },
  dashboards: {
    list: async () => (await http.get('/dashboards')).data,
    create: async (payload: any) => (await http.post('/dashboards', payload)).data,
    get: async (id: string) => (await http.get(`/dashboards/${id}`)).data,
    update: async (id: string, payload: any) => (await http.put(`/dashboards/${id}`, payload)).data,
    remove: async (id: string) => (await http.delete(`/dashboards/${id}`)).data,
    addWidget: async (id: string, payload: any) => (await http.post(`/dashboards/${id}/widgets`, payload)).data,
    updateWidget: async (id: string, widgetId: string, payload: any) => (await http.put(`/dashboards/${id}/widgets/${widgetId}`, payload)).data,
    removeWidget: async (id: string, widgetId: string) => (await http.delete(`/dashboards/${id}/widgets/${widgetId}`)).data,
    publish: async (id: string) => (await http.post(`/dashboards/${id}/publish`)).data,
    duplicate: async (id: string) => (await http.post(`/dashboards/${id}/duplicate`)).data,
    previewData: async (payload: any) => (await http.post('/dashboards/data-preview', payload)).data,
    filterOptions: async (payload: any) => (await http.post('/dashboards/filter-options', payload)).data
  },
  datasets: {
    list: async (params: any = {}) => (await http.get('/datasets', { params })).data,
    get: async (id: string) => (await http.get(`/datasets/${id}`)).data,
    rows: async (id: string, params: any = {}) => (await http.get(`/datasets/${id}/rows`, { params })).data,
    upload: async (form: FormData) => (await http.post('/datasets/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    workbookSheets: async (form: FormData) => (await http.post('/datasets/workbook-sheets', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    replaceFile: async (id: string, form: FormData) => (await http.post(`/datasets/${id}/replace-file`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    appendFile: async (id: string, form: FormData) => (await http.post(`/datasets/${id}/append-file`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    patchRows: async (id: string, form: FormData) => (await http.post(`/datasets/${id}/patch-rows`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
    remove: async (id: string) => (await http.delete(`/datasets/${id}`)).data,
    templateCsvUrl: (id: string) => `${http.defaults.baseURL}/datasets/${id}/template-csv`,
    downloadTemplate: async (id: string) => (await http.get(`/datasets/${id}/template-csv`, { responseType: 'blob' })).data
  },
  users: {
    list: async (params: any = {}) => (await http.get('/users', { params })).data,
    roles: async () => (await http.get('/users/roles')).data,
    create: async (payload: any) => (await http.post('/users', payload)).data,
    update: async (id: string, payload: any) => (await http.put(`/users/${id}`, payload)).data,
    resetPassword: async (id: string, payload: any) => (await http.post(`/users/${id}/reset-password`, payload)).data,
    remove: async (id: string, params: any = {}) => (await http.delete(`/users/${id}`, { params })).data
  },
  audit: { list: async () => (await http.get('/audit-logs')).data },
  templates: {
    list: async () => (await http.get('/import-templates')).data,
    create: async (payload: any) => (await http.post('/import-templates', payload)).data,
    update: async (id: string, payload: any) => (await http.put(`/import-templates/${id}`, payload)).data,
    remove: async (id: string) => (await http.delete(`/import-templates/${id}`)).data
  }
};
