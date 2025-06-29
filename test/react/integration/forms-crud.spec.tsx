/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  clearMockResponses,
  mockFetchResponse,
} from '../../utils/mockFetchResponse';
import { useFetcher } from '../../../src/react/index';

describe('Form & CRUD Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
    clearMockResponses();
  });

  describe('Form Submission', () => {
    it('should handle form submission with validation', async () => {
      global.fetch = jest.fn().mockImplementation(async (url, options) => {
        if (url.includes('/api/users') && options?.method === 'POST') {
          const body = JSON.parse(options.body as string);

          // Return validation error if name is empty or email is problematic
          if (!body.name || body.email === 'existing@example.com') {
            return Promise.resolve({
              ok: false,
              status: 422,
              data: {
                // ✅ Direct data property
                message: 'Validation failed',
                errors: {
                  email:
                    body.email === 'existing@example.com'
                      ? 'Email is already taken'
                      : undefined,
                  name: !body.name ? 'Name is required' : undefined,
                },
              },
            });
          }

          // Return success for valid data
          return Promise.resolve({
            ok: true,
            status: 201,
            data: {
              // ✅ Direct data property
              id: 123,
              name: body.name,
              email: body.email,
              createdAt: new Date().toISOString(),
            },
          });
        }

        return Promise.reject(new Error('Unexpected request'));
      });

      const CreateUserForm = () => {
        const [formData, setFormData] = useState({
          name: '',
          email: '',
        });
        const [submitAttempt, setSubmitAttempt] = useState(0);

        const { data, error, isLoading, refetch } = useFetcher<{
          id: number;
          name: string;
          email: string;
          createdAt: string;
        }>('/api/users', {
          method: 'POST',
          body: formData,
          immediate: false,
          strategy: 'softFail',
        });

        const handleSubmit = (e: FormEvent) => {
          e.preventDefault();
          setSubmitAttempt((prev) => prev + 1);
          refetch();
        };

        const updateField = (field: string, value: string) => {
          setFormData((prev) => ({ ...prev, [field]: value }));
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              data-testid="name-input"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Enter name"
            />
            <input
              data-testid="email-input"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="Enter email"
            />
            <button
              type="submit"
              data-testid="submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create User'}
            </button>

            <div data-testid="form-error">
              {error ? JSON.stringify(error.message) : 'No Error'}
            </div>
            <div data-testid="form-success">
              {data ? `User created with ID: ${data.id}` : 'No Success'}
            </div>
            <div data-testid="submit-count">{submitAttempt}</div>
          </form>
        );
      };

      render(<CreateUserForm />);

      // Fill form with invalid data (will trigger validation error)
      fireEvent.change(screen.getByTestId('name-input'), {
        target: { value: '' },
      });
      fireEvent.change(screen.getByTestId('email-input'), {
        target: { value: 'existing@example.com' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-button'));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('422');
        expect(screen.getByTestId('submit-count')).toHaveTextContent('1');
      });

      // Fix validation issues and resubmit
      fireEvent.change(screen.getByTestId('name-input'), {
        target: { value: 'John Doe' },
      });
      fireEvent.change(screen.getByTestId('email-input'), {
        target: { value: 'john@example.com' },
      });

      fireEvent.click(screen.getByTestId('submit-button'));

      // Should show success
      await waitFor(() => {
        expect(screen.getByTestId('form-success')).toHaveTextContent(
          'User created with ID: 123',
        );
        expect(screen.getByTestId('form-error')).toHaveTextContent('No Error');
        expect(screen.getByTestId('submit-count')).toHaveTextContent('2');
      });
    });

    it('should handle file upload', async () => {
      mockFetchResponse('/api/upload', {
        method: 'POST',
        body: { fileId: 'file-123', fileName: 'document.pdf' },
      });

      const FileUpload = () => {
        const [file, setFile] = useState(null);
        const { data, isLoading, refetch } = useFetcher('/api/upload', {
          method: 'POST',
          body: file ? { file } : null,
          immediate: false,
        });

        return (
          <div>
            <input
              type="file"
              data-testid="file-input"
              // @ts-expect-error File
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => file && refetch()}
              data-testid="upload-button"
            >
              {isLoading ? 'Uploading...' : 'Upload'}
            </button>
            <div data-testid="result">
              {data ? `Uploaded: ${data.fileName}` : 'No Upload'}
            </div>
          </div>
        );
      };

      render(<FileUpload />);

      // Upload file
      const mockFile = new File(['content'], 'document.pdf', {
        type: 'application/pdf',
      });
      const fileInput = screen.getByTestId('file-input');
      Object.defineProperty(fileInput, 'files', { value: [mockFile] });
      fireEvent.change(fileInput);
      fireEvent.click(screen.getByTestId('upload-button'));

      await waitFor(() => {
        expect(screen.getByTestId('result')).toHaveTextContent(
          'Uploaded: document.pdf',
        );
      });
    });

    it('should handle file upload with progress', async () => {
      // Mock file upload response
      mockFetchResponse('/api/upload', {
        method: 'POST',
        body: {
          fileId: 'file-123',
          fileName: 'document.pdf',
          fileSize: 1024000,
          uploadedAt: new Date().toISOString(),
        },
      });

      const FileUploadForm = () => {
        const [selectedFile, setSelectedFile] = useState<File | null>(null);

        const { data, error, isLoading, refetch } = useFetcher('/api/upload', {
          method: 'POST',
          body: selectedFile ? { file: selectedFile } : null,
          immediate: false,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0] || null;
          setSelectedFile(file);
        };

        const handleUpload = () => {
          if (selectedFile) {
            refetch();
          }
        };

        return (
          <div>
            <input
              type="file"
              data-testid="file-input"
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.png"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
              data-testid="upload-button"
            >
              {isLoading ? 'Uploading...' : 'Upload File'}
            </button>

            <div data-testid="upload-status">
              {isLoading ? 'Uploading' : 'Ready'}
            </div>
            <div data-testid="upload-result">
              {data ? `Uploaded: ${data.fileName}` : 'No Upload'}
            </div>
            <div data-testid="upload-error">
              {error ? error.message : 'No Error'}
            </div>
          </div>
        );
      };

      render(<FileUploadForm />);

      // Create mock file
      const mockFile = new File(['mock file content'], 'document.pdf', {
        type: 'application/pdf',
      });

      // Select file
      const fileInput = screen.getByTestId('file-input');
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
      });
      fireEvent.change(fileInput);

      // Upload file
      fireEvent.click(screen.getByTestId('upload-button'));

      expect(screen.getByTestId('upload-status')).toHaveTextContent(
        'Uploading',
      );

      // Should show upload result
      await waitFor(() => {
        expect(screen.getByTestId('upload-result')).toHaveTextContent(
          'Uploaded: document.pdf',
        );
        expect(screen.getByTestId('upload-status')).toHaveTextContent('Ready');
      });
    });
  });

  describe('CRUD Operations', () => {
    it('should handle complete CRUD workflow', async () => {
      // Mock all CRUD operations
      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
      ];

      global.fetch = jest.fn().mockImplementation((url, options) => {
        const method = options?.method || 'GET';

        if (url === '/api/users' && method === 'GET') {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: {
              users,
              total: 2,
            },
          });
        }

        if (url === '/api/users' && method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 201,
            data: { id: 3, name: 'Bob Wilson', email: 'bob@example.com' },
          });
        }

        if (url === '/api/users/1' && method === 'PUT') {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: {
              id: 1,
              name: 'John Updated',
              email: 'john.updated@example.com',
            },
          });
        }

        if (url === '/api/users/2' && method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            status: 200,
            data: { message: 'User deleted successfully' },
          });
        }

        console.log('Unexpeced request:', method, url);
        return Promise.reject(
          new Error(`Unexpected request: ${method} ${url}`),
        );
      });

      const CRUDComponent = () => {
        const [users, setUsers] = useState<
          Array<{ id: number; name: string; email: string }>
        >([]);
        const [editingUser, setEditingUser] = useState<{
          id: number;
          name: string;
          email: string;
        } | null>(null);

        // READ operation
        const { data: usersData } = useFetcher<{
          users: Array<{ id: number; name: string; email: string }>;
          total: number;
        }>('/api/users');

        useEffect(() => {
          if (usersData?.users) {
            setUsers(usersData.users);
          }
        }, [usersData]);

        // CREATE operation
        const { data: createData, refetch: createUser } = useFetcher(
          '/api/users',
          {
            method: 'POST',
            body: { name: 'Bob Wilson', email: 'bob@example.com' },
            immediate: false,
          },
        );

        // UPDATE operation
        const { data: updateData, refetch: updateUser } = useFetcher(
          editingUser ? `/api/users/${editingUser.id}` : null,
          {
            method: 'PUT',
            body: editingUser,
            immediate: false,
          },
        );

        // DELETE operation
        const { data: deleteData, refetch: deleteUser } = useFetcher(
          '/api/users/2',
          {
            method: 'DELETE',
            immediate: false,
          },
        );

        const handleCreate = () => {
          createUser();
        };

        const handleUpdate = () => {
          setEditingUser({
            id: 1,
            name: 'John Updated',
            email: 'john.updated@example.com',
          });
          setTimeout(() => updateUser(), 100);
        };

        const handleDelete = () => {
          deleteUser();
        };

        return (
          <div>
            <div data-testid="users-list">
              {users.map((user) => (
                <div key={user.id} data-testid={`user-${user.id}`}>
                  {user.name} - {user.email}
                </div>
              ))}
            </div>

            <button onClick={handleCreate} data-testid="create-button">
              Create User
            </button>
            <button onClick={handleUpdate} data-testid="update-button">
              Update User 1
            </button>
            <button onClick={handleDelete} data-testid="delete-button">
              Delete User 2
            </button>

            <div data-testid="create-result">
              {createData ? `Created: ${createData.name}` : 'No Create'}
            </div>
            <div data-testid="update-result">
              {updateData ? `Updated: ${updateData.name}` : 'No Update'}
            </div>
            <div data-testid="delete-result">
              {deleteData ? deleteData.message : 'No Delete'}
            </div>
          </div>
        );
      };

      render(<CRUDComponent />);

      // Should load initial users (READ)
      await waitFor(() => {
        expect(screen.getByTestId('user-1')).toHaveTextContent(
          'John Doe - john@example.com',
        );
        expect(screen.getByTestId('user-2')).toHaveTextContent(
          'Jane Smith - jane@example.com',
        );
      });

      // Test CREATE
      fireEvent.click(screen.getByTestId('create-button'));

      await waitFor(() => {
        expect(screen.getByTestId('create-result')).toHaveTextContent(
          'Created: Bob Wilson',
        );
      });

      // Test UPDATE
      fireEvent.click(screen.getByTestId('update-button'));

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByTestId('update-result')).toHaveTextContent(
          'Updated: John Updated',
        );
      });

      // Test DELETE
      fireEvent.click(screen.getByTestId('delete-button'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-result')).toHaveTextContent(
          'User deleted successfully',
        );
      });
    });
  });

  describe('Optimistic Updates', () => {
    it('should handle optimistic updates with rollback on error', async () => {
      let updateAttempt = 0;

      global.fetch = jest.fn().mockImplementation((_url, options) => {
        if (options?.method === 'PUT') {
          updateAttempt++;

          if (updateAttempt === 1) {
            // First update fails
            return Promise.resolve({
              ok: false,
              status: 500,
              statusText: 'Server Error',
            });
          } else {
            // Second update succeeds
            return Promise.resolve({
              ok: true,
              status: 200,
              data: { id: 1, name: 'John Updated', status: 'active' },
            });
          }
        }

        // Initial data
        return Promise.resolve({
          ok: true,
          status: 200,
          data: { id: 1, name: 'John Doe', status: 'active' },
        });
      });

      const OptimisticUpdateComponent = () => {
        const [localData, setLocalData] = useState<{
          id: number;
          name: string;
          status: string;
        } | null>(null);
        const [isOptimistic, setIsOptimistic] = useState(false);

        const { data: serverData } = useFetcher<{
          id: number;
          name: string;
          status: string;
        }>('/api/user/1');

        const {
          data: updateData,
          error,
          isLoading,
          refetch: updateUser,
        } = useFetcher('/api/user/1', {
          method: 'PUT',
          body: { name: 'John Updated', status: 'active' },
          immediate: false,
          strategy: 'softFail',
        });

        useEffect(() => {
          if (serverData && !isOptimistic) {
            setLocalData(serverData);
          }
        }, [serverData, isOptimistic]);

        // Handle error - rollback optimistic update
        useEffect(() => {
          if (error && isOptimistic) {
            setLocalData(serverData);
            setIsOptimistic(false);
          }
        }, [error, isOptimistic, serverData]);

        // Handle success - confirm optimistic update
        useEffect(() => {
          if (updateData && isOptimistic) {
            setLocalData(updateData);
            setIsOptimistic(false);
          }
        }, [updateData, isOptimistic]);

        const handleOptimisticUpdate = () => {
          // Optimistically update UI
          setLocalData({ id: 1, name: 'John Updated', status: 'active' });
          setIsOptimistic(true);

          // Perform actual update
          updateUser();
        };

        return (
          <div>
            <div data-testid="user-name">{localData?.name || 'Loading...'}</div>
            <div data-testid="update-status">
              {isLoading ? 'Updating...' : 'Ready'}
            </div>
            <div data-testid="optimistic-indicator">
              {isOptimistic ? 'Optimistic' : 'Server Data'}
            </div>
            <div data-testid="update-error">
              {error ? `Error: ${error.status}` : 'No Error'}
            </div>
            <button
              onClick={handleOptimisticUpdate}
              data-testid="update-button"
            >
              Update Name
            </button>
          </div>
        );
      };

      render(<OptimisticUpdateComponent />);

      // Should show initial data
      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
        expect(screen.getByTestId('optimistic-indicator')).toHaveTextContent(
          'Server Data',
        );
      });

      // Perform optimistic update (will fail)
      fireEvent.click(screen.getByTestId('update-button'));

      // Should immediately show optimistic update
      expect(screen.getByTestId('user-name')).toHaveTextContent('John Updated');
      expect(screen.getByTestId('optimistic-indicator')).toHaveTextContent(
        'Optimistic',
      );

      // Should rollback on error
      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
        expect(screen.getByTestId('optimistic-indicator')).toHaveTextContent(
          'Server Data',
        );
        expect(screen.getByTestId('update-error')).toHaveTextContent(
          'Error: 500',
        );
      });

      // Try again (will succeed)
      await act(async () => {
        fireEvent.click(screen.getByTestId('update-button'));

        // Should eventually show successful update
        await waitFor(() => {
          expect(screen.getByTestId('user-name')).toHaveTextContent(
            'John Updated',
          );
          expect(screen.getByTestId('update-error')).toHaveTextContent(
            'No Error',
          );
        });
      });
    });
  });
});
